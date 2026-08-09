"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button, Skeleton } from "@useroutr/ui";
import { useToast } from "@useroutr/ui";
import Link from "next/link";
import { LinkStatusBadge } from "@/components/links/LinkStatusBadge";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

import type { PaymentLink } from "@useroutr/types";

interface LinkStats {
  totalViews?: number;
  totalPayments?: number;
  conversionRate?: number;
  totalRevenue?: number;
  currency?: string;
}

interface LinkPayment {
  id: string;
  payer?: string;
  amount: number;
  currency: string;
  status: string;
}

export default function LinkDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [link, setLink] = useState<PaymentLink | null>(null);
  const [stats, setStats] = useState<LinkStats | null>(null);
  const [payments, setPayments] = useState<LinkPayment[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchData() {
    try {
      setLoading(true);

      // allSettled, not all: a missing link is "not found" (no toast), while a
      // failing stats/payments call should still leave the link itself usable.
      const [linkResult, statsResult, paymentsResult] = await Promise.allSettled(
        [
          api.get<PaymentLink>(`/payment-links/${id}`),
          api.get<LinkStats>(`/payment-links/${id}/stats`),
          // `/payments` is paginated: the envelope is { items, meta }, and the
          // api client has already unwrapped the outer { data }. Reading
          // `.data` here would always be undefined and the table would render
          // empty with no error to explain why.
          api.get<{ items?: LinkPayment[] }>(`/payments`, {
            params: { linkId: id },
          }),
        ]
      );

      if (linkResult.status !== "fulfilled") {
        setLink(null);
        return;
      }

      setLink(linkResult.value);
      setStats(statsResult.status === "fulfilled" ? statsResult.value : null);
      setPayments(
        paymentsResult.status === "fulfilled"
          ? (paymentsResult.value?.items ?? [])
          : []
      );
    } catch {
      toast(`Failed to load link`, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [id]);

  async function copyUrl() {
    if (!link) return;
    await navigator.clipboard.writeText(link.url);
    toast("Copied link", "success");
  }

  function downloadQr() {
    if (!link?.qrCodeUrl) return;

    const a = document.createElement("a");
    a.href = link.qrCodeUrl;
    a.download = `${link.id}.png`;
    a.click();
  }

  async function deactivate() {
    if (!link) return;

    const ok = window.confirm(
      "Are you sure you want to deactivate this link?"
    );

    if (!ok) return;

    try {
      await api.delete(`/payment-links/${link.id}`);
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Failed to deactivate link",
        "error"
      );
      return;
    }

    toast("Link deactivated", "success");

    fetchData();
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (!link) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Link not found</p>
        <Link href="/links">
          <Button className="mt-4">Back to links</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* BACK */}
      <Link
        href="/links"
        className="text-sm text-muted-foreground"
      >
        ← Back to links
      </Link>

      {/* HERO */}
      <div className="rounded-lg border p-6 space-y-3">
        <div className="flex justify-between">
          <span className="font-mono text-xs">{link.id}</span>
          <LinkStatusBadge status={link.status} />
        </div>

        <div className="text-3xl font-semibold">
          {link.amount
            ? formatCurrency(link.amount, link.currency)
            : "Open amount"}
        </div>

        <p className="text-sm text-muted-foreground">
          {link.description}
        </p>

        {/* ACTIONS */}
        <div className="flex gap-2 pt-2">
          <Button onClick={copyUrl} className="flex-1">
            Copy URL
          </Button>

          <Button onClick={downloadQr} className="flex-1">
            Download QR
          </Button>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Views" value={stats?.totalViews ?? 0} />
        <Stat label="Payments" value={stats?.totalPayments ?? 0} />
        <Stat
          label="Conversion"
          value={`${stats?.conversionRate ?? 0}%`}
        />
        <Stat
          label="Revenue"
          value={formatCurrency(
            stats?.totalRevenue ?? 0,
            stats?.currency ?? link.currency
          )}
        />
      </div>

      {/* PAYMENTS */}
      <div className="border rounded-lg p-6">
        <h3 className="mb-4 font-medium">Recent Payments</h3>

        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No payments yet
          </p>
        ) : (
          <div className="space-y-2">
            {payments.slice(0, 10).map((p) => (
              <Link
                key={p.id}
                href={`/payments/${p.id}`}
                className="flex justify-between text-sm border-b py-2"
              >
                <span>{p.payer ?? "—"}</span>
                <span>
                  {formatCurrency(p.amount, p.currency)}
                </span>
                <span>{p.status}</span>
              </Link>
            ))}
          </div>
        )}

        <Link
          href={`/payments?linkId=${link.id}`}
          className="text-sm text-primary block mt-4"
        >
          View all payments →
        </Link>
      </div>

      {/* SIDEBAR */}
      <div className="border rounded-lg p-6 space-y-2">
        <p>
          <strong>Created:</strong>{" "}
          {new Date(link.createdAt).toLocaleString()}
        </p>

        <p>
          <strong>Updated:</strong>{" "}
          {new Date(link.updatedAt).toLocaleString()}
        </p>

        <p>
          <strong>Type:</strong> {link.type}
        </p>

        <p>
          <strong>Expiry:</strong>{" "}
          {link.expiresAt
            ? new Date(link.expiresAt).toLocaleDateString()
            : "Never"}
        </p>

        {link.status === "active" && (
          <Button
            variant="destructive"
            className="w-full mt-3"
            onClick={deactivate}
          >
            Deactivate Link
          </Button>
        )}
      </div>
    </div>
  );
}

/* ---------- helper ---------- */
function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="border rounded-lg p-4">
      <div className="text-xs text-muted-foreground">
        {label}
      </div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}