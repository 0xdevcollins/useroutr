"use client";

import { useMemo, useState } from "react";
import { Button, Pagination, Skeleton, useToast } from "@useroutr/ui";
import { Plus } from "@phosphor-icons/react";
import {
  usePaymentLinks,
  useCreatePaymentLink,
  useDeactivatePaymentLink,
} from "@/hooks/usePaymentLinks";
import { LinkCard } from "@/components/links/LinkCard";
import { CreateLinkModal } from "@/components/links/CreateLinkModal";
import { LinkCreatedModal } from "@/components/links/LinkCreatedModal";
import { QRCodeModal } from "@/components/links/QRCodeModal";
import { SearchInput } from "@/components/payments/SearchInput";
import { PageHeader } from "@/components/brand/PageHeader";
import { EmptyState } from "@/components/brand/EmptyState";
import type { CreatePaymentLinkInput, PaymentLink } from "@useroutr/types";

/**
 * The merchant's payment links.
 *
 * This route previously rendered the *detail* page: it called
 * `useParams<{ id }>()` on `/links`, a route with no `[id]` segment, so `id`
 * was always undefined and the page requested `/payment-links/undefined`. The
 * detail view now lives at `/links/[id]`, where its param exists.
 */

const FILTERS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "expired", label: "Expired" },
  { value: "deactivated", label: "Deactivated" },
] as const;

type FilterValue = (typeof FILTERS)[number]["value"];

export default function LinksPage() {
  const { toast } = useToast();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(12);
  const [status, setStatus] = useState<FilterValue>("all");
  const [search, setSearch] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [qrLink, setQrLink] = useState<PaymentLink | null>(null);
  const [createdLink, setCreatedLink] = useState<PaymentLink | null>(null);

  const { data, isLoading, isError, error } = usePaymentLinks({
    page,
    limit,
    status,
  });
  const createLink = useCreatePaymentLink();
  const deactivateLink = useDeactivatePaymentLink();

  const links = useMemo(() => data?.data ?? [], [data]);
  const meta = data?.meta;

  // Search filters the current page only. The API has no search parameter for
  // links yet, so filtering server-side would silently return nothing; this at
  // least does what it appears to do. Worth moving server-side once the
  // endpoint supports it.
  const visibleLinks = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return links;
    return links.filter(
      (link) =>
        link.description?.toLowerCase().includes(q) ||
        link.id.toLowerCase().includes(q),
    );
  }, [links, search]);

  const hasFilters = status !== "all" || search.trim() !== "";
  const showEmptyState = !isLoading && links.length === 0 && !hasFilters;

  function changeStatus(next: FilterValue) {
    setStatus(next);
    // Page 3 of "all" is rarely page 3 of "expired"; staying put would show an
    // empty page for a filter that has results.
    setPage(1);
  }

  async function handleCreate(input: CreatePaymentLinkInput) {
    try {
      const link = await createLink.mutateAsync(input);
      setCreateOpen(false);

      // Best-effort: clipboard access can be denied, and the URL is shown in
      // the modal regardless, so a failure here is not worth an error toast.
      try {
        await navigator.clipboard.writeText(link.url);
        toast("Link created and copied to clipboard", "success");
      } catch {
        toast("Link created", "success");
      }

      setCreatedLink(link);
    } catch (err) {
      // Surfaces the API envelope's error.message — "insufficient liquidity"
      // reads very differently from a generic failure.
      toast(err instanceof Error ? err.message : "Failed to create link", "error");
    }
  }

  async function handleDeactivate(link: PaymentLink) {
    try {
      await deactivateLink.mutateAsync(link.id);
      toast("Link deactivated", "success");
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Failed to deactivate link",
        "error",
      );
    }
  }

  return (
    <div className="space-y-8 dashboard-enter">
      <PageHeader
        eyebrow="Payment links"
        title={
          <>
            Get paid with{" "}
            <span className="editorial-italic text-muted-foreground">
              a URL.
            </span>
          </>
        }
        description={
          meta && meta.total > 0
            ? `${meta.total.toLocaleString()} link${meta.total === 1 ? "" : "s"} created. Share one anywhere a customer can click.`
            : "Create a link, share it anywhere, and take payment without writing any code."
        }
        actions={
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus size={16} />
            New link
          </Button>
        }
      />

      {!showEmptyState && (
        <div className="flex flex-col gap-4">
          <SearchInput value={search} onSearch={setSearch} />
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => changeStatus(filter.value)}
                aria-pressed={status === filter.value}
                className={
                  status === filter.value
                    ? "rounded-full border border-foreground bg-foreground px-3.5 py-1.5 text-xs font-medium text-background"
                    : "rounded-full border border-border px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
                }
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm text-destructive">
          {error instanceof Error
            ? error.message
            : "Could not load your payment links."}
        </div>
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      ) : showEmptyState ? (
        <EmptyState
          variant="links"
          title="No payment links yet"
          body="A payment link is the fastest way to take money — no integration, no code. Create one and share the URL."
          cta={{
            label: "Create your first link",
            onClick: () => setCreateOpen(true),
          }}
        />
      ) : visibleLinks.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground">
          No links match these filters.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleLinks.map((link) => (
            <LinkCard
              key={link.id}
              link={link}
              onQRCode={setQrLink}
              onDeactivate={handleDeactivate}
            />
          ))}
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <Pagination
          page={meta.page}
          totalPages={meta.totalPages}
          totalItems={meta.total}
          pageSize={meta.limit}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setLimit(size);
            setPage(1);
          }}
        />
      )}

      <CreateLinkModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={handleCreate}
        isLoading={createLink.isPending}
      />

      {createdLink && (
        <LinkCreatedModal
          open={Boolean(createdLink)}
          onOpenChange={(open) => !open && setCreatedLink(null)}
          linkUrl={createdLink.url}
          linkName={createdLink.description ?? "Payment link"}
        />
      )}

      {qrLink && (
        <QRCodeModal
          open={Boolean(qrLink)}
          onOpenChange={(open) => !open && setQrLink(null)}
          url={qrLink.url}
          linkName={qrLink.description ?? "Payment link"}
        />
      )}
    </div>
  );
}
