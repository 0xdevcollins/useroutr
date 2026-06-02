"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Input,
  EmptyState,
  Skeleton,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Pagination,
} from "@useroutr/ui";
import { Plus, MagnifyingGlass, Link as LinkIcon } from "@phosphor-icons/react";
import { useToast } from "@useroutr/ui";
import { PageHeader } from "@/components/brand/PageHeader";
import { EmptyState as BrandEmptyState } from "@/components/brand/EmptyState";
import { LinkCard } from "@/components/links/LinkCard";
import { CreateLinkModal } from "@/components/links/CreateLinkModal";
import { LinkCreatedModal } from "@/components/links/LinkCreatedModal";
import { QRCodeModal } from "@/components/links/QRCodeModal";
import {
  useLinks,
  useCreateLink,
  useDeactivateLink,
} from "@/hooks/useLinks";
import { useDashboardSocket } from "@/hooks/useDashboardSocket";
import type { PaymentLink, CreatePaymentLinkInput } from "@useroutr/types";

type StatusFilter = "all" | "active" | "expired" | "deactivated";

// Simple debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

function LinkCardSkeleton() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="mt-4 h-7 w-24" />
      <Skeleton className="mt-3 h-4 w-full" />
      <div className="mt-4 flex items-center justify-between">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="mt-4 flex gap-2 border-t border-[var(--border)] pt-4">
        <Skeleton className="h-8 flex-1" />
        <Skeleton className="h-8 flex-1" />
        <Skeleton className="h-8 w-8" />
      </div>
    </div>
  );
}

export default function PaymentLinksPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(12);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createdLink, setCreatedLink] = useState<PaymentLink | null>(null);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [selectedLinkForQR, setSelectedLinkForQR] = useState<PaymentLink | null>(null);
  const [linkToDeactivate, setLinkToDeactivate] = useState<PaymentLink | null>(null);

  // Debounce search input (300ms)
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading, refetch } = useLinks({
    page,
    limit,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  const createMutation = useCreateLink();
  const deactivateMutation = useDeactivateLink();

  // WebSocket for real-time payment notifications
  const { subscribe } = useDashboardSocket();

  useEffect(() => {
    // Refresh the link list when a real-time link payment event arrives.
    const unsubscribe = subscribe("payment-link.payment", () => {
      refetch();
    });

    return () => unsubscribe();
  }, [subscribe, refetch]);

  const handleCreate = (data: CreatePaymentLinkInput) => {
    createMutation.mutate(data, {
      onSuccess: async (newLink) => {
        setCreatedLink(newLink);
        setIsCreateModalOpen(false);

        try {
          await navigator.clipboard.writeText(newLink.url);
          toast(`Payment link created and copied: ${newLink.url}`, "success");
        } catch {
          toast(`Payment link created: ${newLink.url}`, "success");
        }
      },
      onError: (error) => {
        toast(error.message, "error");
      },
    });
  };

  const handleDeactivate = (link: PaymentLink) => {
    setLinkToDeactivate(link);
  };

  const confirmDeactivate = () => {
    if (!linkToDeactivate) return;

    deactivateMutation.mutate(linkToDeactivate.id, {
      onSuccess: () => {
        toast("Link deactivated successfully", "success");
        setLinkToDeactivate(null);
      },
      onError: (error) => {
        toast(error.message, "error");
      },
    });
  };

  const handleQRCode = (link: PaymentLink) => {
    setSelectedLinkForQR(link);
    setIsQRModalOpen(true);
  };

  const allLinks = data?.data ?? [];
  const links = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    if (!query) return allLinks;

    return allLinks.filter((link) =>
      (link.description ?? "").toLowerCase().includes(query),
    );
  }, [allLinks, debouncedSearch]);

  const totalLinks = data?.meta.total ?? 0;
  const totalPages = data?.meta.totalPages ?? 0;
  const hasLinks = links.length > 0;

  // Determine if filters are active
  const hasActiveFilters = debouncedSearch.length > 0 || statusFilter !== "all";

  // Show empty state for "no links" vs "no results"
  const showNoResults = hasActiveFilters && !hasLinks;
  const showNoLinks = !hasActiveFilters && !hasLinks;

  const statusChips: Array<{ value: StatusFilter; label: string }> = [
    { value: "all", label: "All" },
    { value: "active", label: "Active" },
    { value: "expired", label: "Expired" },
    { value: "deactivated", label: "Deactivated" },
  ];

  return (
    <div className="space-y-8 dashboard-enter">
      <PageHeader
        eyebrow="Payment links"
        title={
          <>
            Shareable URLs that{" "}
            <span className="editorial-italic text-muted-foreground">
              actually pay.
            </span>
          </>
        }
        description="Fixed amount or open, single-use or reusable. Generate a link and share it anywhere — checkout opens on click."
        actions={
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus size={18} />
            New link
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1 max-w-sm">
          <MagnifyingGlass
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
          />
          <Input
            placeholder="Search links..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {statusChips.map((chip) => (
            <Button
              key={chip.value}
              type="button"
              size="sm"
              variant={statusFilter === chip.value ? "primary" : "outline"}
              onClick={() => {
                setStatusFilter(chip.value);
                setPage(1);
              }}
            >
              {chip.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Links Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <LinkCardSkeleton key={i} />
          ))}
        </div>
      ) : hasLinks ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {links.map((link) => (
            <LinkCard
              key={link.id}
              link={link}
              onQRCode={handleQRCode}
              onDeactivate={handleDeactivate}
            />
          ))}
        </div>
      ) : showNoResults ? (
        <EmptyState
          icon={LinkIcon}
          title="No links match your filters"
          description="Try adjusting your search or filter criteria"
          action={
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
              }}
            >
              Clear Filters
            </Button>
          }
        />
      ) : showNoLinks ? (
        <BrandEmptyState
          variant="links"
          title="No payment links yet"
          body="Create a shareable URL with a fixed or open amount, optional expiry, and single-use lock. We'll handle the checkout."
          cta={{
            label: "Create your first link",
            onClick: () => setIsCreateModalOpen(true),
          }}
        />
      ) : null}

      <Pagination
        page={page}
        totalPages={totalPages}
        totalItems={totalLinks}
        pageSize={limit}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setLimit(size);
          setPage(1);
        }}
        pageSizeOptions={[12, 24, 48]}
      />

      {/* Create Link Modal */}
      <CreateLinkModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onCreate={handleCreate}
        isLoading={createMutation.isPending}
      />

      {/* Link Created Modal */}
      {createdLink && (
        <LinkCreatedModal
          open={!!createdLink}
          onOpenChange={(open) => {
            if (!open) setCreatedLink(null);
          }}
          linkUrl={createdLink.url}
          linkName={createdLink.description || "Payment Link"}
        />
      )}

      {/* QR Code Modal */}
      {selectedLinkForQR && (
        <QRCodeModal
          open={isQRModalOpen}
          onOpenChange={setIsQRModalOpen}
          url={selectedLinkForQR.url}
          linkName={selectedLinkForQR.description || "Payment Link"}
        />
      )}

      {/* Deactivate Confirmation Dialog */}
      <Dialog
        open={!!linkToDeactivate}
        onOpenChange={(open) => {
          if (!open) setLinkToDeactivate(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Deactivate Link</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate this payment link? No more payments will be accepted.
            </DialogDescription>
          </DialogHeader>

          {linkToDeactivate && (
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background)] p-4">
              <p className="font-medium text-[var(--foreground)]">
                {linkToDeactivate.description || linkToDeactivate.id}
              </p>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                {linkToDeactivate.url}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setLinkToDeactivate(null)}
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
