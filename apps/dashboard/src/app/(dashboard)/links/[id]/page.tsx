"use client";

import { use } from "react";
import { notFound, useRouter } from "next/navigation";
import {
  usePaymentLink,
  usePaymentLinkStats,
  useDeactivatePaymentLink,
} from "@/hooks/usePaymentLinks";
import { useToast } from "@useroutr/ui";
import { Button, Skeleton } from "@useroutr/ui";
import { PageHeader } from "@/components/brand/PageHeader";
import { LinkStatusBadge } from "@/components/links/LinkStatusBadge";
import { CopyButton } from "@/components/links/CopyButton";
import { formatCurrency } from "@/lib/utils";
import { ArrowLeft, QrCode, Trash } from "@phosphor-icons/react";
import { QRCodeModal } from "@/components/links/QRCodeModal";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@useroutr/ui";

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-rule last:border-0">
      <dt
        className="shrink-0 text-[11px] uppercase tracking-[0.1em] text-text-faint"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {label}
      </dt>
      <dd className="text-right text-[13px] text-foreground">{children}</dd>
    </div>
  );
}

export default function LinkDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const [isQROpen, setIsQROpen] = useState(false);
  const [isDeactivateOpen, setIsDeactivateOpen] = useState(false);

  const { data: link, isLoading, isError } = usePaymentLink(id);
  const { data: stats } = usePaymentLinkStats(id);
  const deactivateMutation = useDeactivatePaymentLink();

  if (isLoading) {
    return (
      <div className="space-y-8 dashboard-enter">
        <div className="flex items-center gap-3 border-b border-rule pb-6">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 surface p-6 space-y-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
          <div className="surface p-6 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError || !link) {
    notFound();
  }

  const canDeactivate = link.status === "active";

  const confirmDeactivate = () => {
    deactivateMutation.mutate(id, {
      onSuccess: () => {
        toast("Link deactivated successfully", "success");
        setIsDeactivateOpen(false);
        router.push("/links");
      },
      onError: (err) => {
        toast(`Failed to deactivate: ${err.message}`, "error");
      },
    });
  };

  const expiryLabel = link.expiresAt
    ? new Date(link.expiresAt).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "Never";

  const createdLabel = new Date(link.createdAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="space-y-8 dashboard-enter">
      <PageHeader
        eyebrow="Payment links"
        title={
          <>
            {link.description ? (
              link.description
            ) : (
              <span
                className="text-muted-foreground"
                style={{ fontFamily: "var(--font-mono)", fontSize: "0.8em" }}
              >
                {link.id}
              </span>
            )}
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => router.push("/links")}
            >
              <ArrowLeft size={16} />
              Back
            </Button>
            <CopyButton value={link.url} feedbackText="Copied" />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsQROpen(true)}
            >
              <QrCode size={16} />
              QR Code
            </Button>
            {canDeactivate && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsDeactivateOpen(true)}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash size={16} />
                Deactivate
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main details card */}
        <div className="surface p-6 lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">
              Link details
            </h2>
            <LinkStatusBadge status={link.status} />
          </div>

          <dl>
            <DetailRow label="ID">
              <span style={{ fontFamily: "var(--font-mono)" }}>{link.id}</span>
            </DetailRow>
            <DetailRow label="Amount">
              {link.amount
                ? formatCurrency(link.amount, link.currency)
                : "Open amount"}
            </DetailRow>
            <DetailRow label="Currency">{link.currency}</DetailRow>
            <DetailRow label="Type">
              {link.type === "single-use" ? "Single-use" : "Multi-use"}
            </DetailRow>
            <DetailRow label="Status">
              <LinkStatusBadge status={link.status} />
            </DetailRow>
            {link.description && (
              <DetailRow label="Description">{link.description}</DetailRow>
            )}
            <DetailRow label="Expires">{expiryLabel}</DetailRow>
            <DetailRow label="Created">{createdLabel}</DetailRow>
          </dl>

          {/* URL row */}
          <div className="mt-4 pt-4 border-t border-rule">
            <p
              className="mb-1 text-[10px] uppercase tracking-[0.1em] text-text-faint"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Payment URL
            </p>
            <div className="flex items-center gap-2">
              <span className="flex-1 truncate rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground">
                {link.url}
              </span>
              <CopyButton value={link.url} feedbackText="Copied" />
            </div>
          </div>
        </div>

        {/* Stats sidebar */}
        <div className="space-y-4">
          <div className="surface p-6">
            <h2 className="mb-4 text-sm font-semibold text-foreground">
              Usage stats
            </h2>
            <dl className="space-y-4">
              <div>
                <dt
                  className="text-[10px] uppercase tracking-[0.1em] text-text-faint"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  Total uses
                </dt>
                <dd className="mt-1 text-3xl font-semibold text-foreground tabular-nums">
                  {link.usageCount}
                </dd>
              </div>
              {stats && (
                <>
                  <div>
                    <dt
                      className="text-[10px] uppercase tracking-[0.1em] text-text-faint"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      Total collected
                    </dt>
                    <dd className="mt-1 text-3xl font-semibold text-foreground tabular-nums">
                      {formatCurrency(stats.totalAmount, link.currency)}
                    </dd>
                  </div>
                  {stats.lastPaymentAt && (
                    <div>
                      <dt
                        className="text-[10px] uppercase tracking-[0.1em] text-text-faint"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        Last payment
                      </dt>
                      <dd className="mt-1 text-sm text-foreground">
                        {new Date(stats.lastPaymentAt).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          }
                        )}
                      </dd>
                    </div>
                  )}
                </>
              )}
            </dl>
          </div>
        </div>
      </div>

      {/* QR Code modal */}
      <QRCodeModal
        open={isQROpen}
        onOpenChange={setIsQROpen}
        url={link.url}
        linkName={link.description ?? link.id}
      />

      {/* Deactivate confirmation */}
      <Dialog open={isDeactivateOpen} onOpenChange={setIsDeactivateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Deactivate Link</DialogTitle>
            <DialogDescription>
              Are you sure? No more payments will be accepted through this link.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border bg-background p-4">
            <p className="font-medium text-foreground">
              {link.description ?? link.id}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{link.url}</p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeactivateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDeactivate}
              loading={deactivateMutation.isPending}
            >
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
