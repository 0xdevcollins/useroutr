"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { usePayouts, useRetryPayout, useCancelPayout, type Payout, type PayoutStatus, type DestType } from "@/hooks/usePayouts";
import { DataTable, type Column, Pagination, Button, EmptyState, Skeleton } from "@useroutr/ui";
import { DateRange } from "react-day-picker";
import { Receipt, ArrowCounterClockwise, Prohibit } from "@phosphor-icons/react";

import { PayoutStatusBadge } from "@/components/payouts/PayoutStatusBadge";
import { PayoutSearchInput } from "@/components/payouts/PayoutSearchInput";
import { PayoutFilterBar } from "@/components/payouts/PayoutFilterBar";
import { PayoutDetailDrawer } from "@/components/payouts/PayoutDetailDrawer";
import { PayoutExportButton } from "@/components/payouts/PayoutExportButton";
import { CancelConfirmationModal } from "@/components/payouts/CancelConfirmationModal";
import { BatchGroupHeader } from "@/components/payouts/BatchGroupHeader";
import { formatCurrency, truncateAddress } from "@/lib/utils";
import { useToast } from "@useroutr/ui";
import { PageHeader } from "@/components/brand/PageHeader";

type PayoutWithIndex = Payout & Record<string, unknown>;

interface GroupedPayouts {
  batched: Map<string, Payout[]>;
  unbatched: Payout[];
}

function groupPayoutsByBatch(payouts: Payout[]): GroupedPayouts {
  const batched = new Map<string, Payout[]>();
  const unbatched: Payout[] = [];

  for (const payout of payouts) {
    if (payout.batchId) {
      const existing = batched.get(payout.batchId) || [];
      existing.push(payout);
      batched.set(payout.batchId, existing);
    } else {
      unbatched.push(payout);
    }
  }

  return { batched, unbatched };
}

export default function PayoutsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  // ── URL Sync & State ────────────────────────────────────────────────────────

  const [offset, setOffset] = useState(Number(searchParams.get("offset")) || 0);
  const [limit, setLimit] = useState(Number(searchParams.get("limit")) || 20);
  const [status, setStatus] = useState<PayoutStatus | "">(
    (searchParams.get("status") as PayoutStatus) || ""
  );
  const [destinationType, setDestinationType] = useState<DestType | "">(
    (searchParams.get("destinationType") as DestType) || ""
  );
  const [currency, setCurrency] = useState(searchParams.get("currency") || "");
  const [dateFrom, setDateFrom] = useState(searchParams.get("dateFrom") || "");
  const [dateTo, setDateTo] = useState(searchParams.get("dateTo") || "");
  const [batchId, setBatchId] = useState(searchParams.get("batchId") || "");
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [groupByBatch, setGroupByBatch] = useState(
    searchParams.get("groupByBatch") === "true"
  );
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());

  // ── Drawer & Modal State ─────────────────────────────────────────────────────

  const [selectedPayout, setSelectedPayout] = useState<Payout | undefined>();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);

  // ── Data Fetching ───────────────────────────────────────────────────────────

  const { data, isLoading, isFetching, error } = usePayouts({
    offset,
    limit,
    status: status || undefined,
    destinationType: destinationType || undefined,
    currency: currency || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    batchId: batchId || undefined,
    search: search || undefined,
  });

  const payouts = data?.data || [];
  const totalPayouts = data?.total || 0;

  // ── Grouping ─────────────────────────────────────────────────────────────────

  const groupedPayouts = useMemo(() => {
    if (!groupByBatch) return null;
    return groupPayoutsByBatch(payouts);
  }, [payouts, groupByBatch]);

  // ── Mutations ────────────────────────────────────────────────────────────────

  const retryMutation = useRetryPayout();
  const cancelMutation = useCancelPayout();

  // ── URL Update ───────────────────────────────────────────────────────────────

  const updateUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (offset > 0) params.set("offset", String(offset));
    if (limit !== 20) params.set("limit", String(limit));
    if (status) params.set("status", status);
    if (destinationType) params.set("destinationType", destinationType);
    if (currency) params.set("currency", currency);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (batchId) params.set("batchId", batchId);
    if (search) params.set("search", search);
    if (groupByBatch) params.set("groupByBatch", "true");

    const queryString = params.toString();
    const newUrl = queryString ? `?${queryString}` : "";
    window.history.replaceState(null, "", newUrl);
  }, [offset, limit, status, destinationType, currency, dateFrom, dateTo, batchId, search, groupByBatch]);

  useEffect(() => {
    updateUrl();
  }, [updateUrl]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const resetFilters = () => {
    setOffset(0);
    setStatus("");
    setDestinationType("");
    setCurrency("");
    setDateFrom("");
    setDateTo("");
    setBatchId("");
    setSearch("");
    setGroupByBatch(false);
    setExpandedBatches(new Set());
  };

  const handleSearch = (query: string) => {
    setSearch(query);
    setOffset(0);
  };

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus as PayoutStatus | "");
    setOffset(0);
  };

  const handleDestinationTypeChange = (type: string) => {
    setDestinationType(type as DestType | "");
    setOffset(0);
  };

  const handleCurrencyChange = (curr: string) => {
    setCurrency(curr);
    setOffset(0);
  };

  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDateFrom(range?.from ? range.from.toISOString() : "");
    setDateTo(range?.to ? range.to.toISOString() : "");
    setOffset(0);
  };

  const handleBatchIdChange = (id: string) => {
    setBatchId(id);
    setOffset(0);
  };

  const toggleBatchExpansion = (id: string) => {
    setExpandedBatches((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleRowClick = (payout: Payout) => {
    setSelectedPayout(payout);
    setDrawerOpen(true);
  };

  const handleRetry = async (id: string) => {
    try {
      await retryMutation.mutateAsync(id);
      toast("The payout has been queued for retry.", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to retry payout", "error");
    }
  };

  const handleCancelClick = (payout: Payout) => {
    setSelectedPayout(payout);
    setCancelModalOpen(true);
  };

  const handleCancelConfirm = async () => {
    if (!selectedPayout) return;
    try {
      await cancelMutation.mutateAsync(selectedPayout.id);
      setCancelModalOpen(false);
      toast("The payout has been cancelled successfully.", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to cancel payout", "error");
    }
  };

  // ── Table Columns ───────────────────────────────────────────────────────────

  const columns: Column<PayoutWithIndex>[] = useMemo(
    () => [
      {
        key: "id",
        header: "Payout ID",
        sortable: false,
        render: (payout) => (
          <span className="font-mono text-xs text-muted-foreground">
            {payout.id.slice(0, 12)}...
          </span>
        ),
      },
      {
        key: "recipientName",
        header: "Recipient",
        sortable: false,
        render: (payout) => (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
              <span className="text-xs font-medium">
                {(payout.recipientName ?? "?").charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="font-medium">{payout.recipientName ?? "—"}</span>
          </div>
        ),
      },
      {
        key: "amount",
        header: "Amount",
        sortable: false,
        render: (payout) => (
          <span className="font-medium">
            {formatCurrency(Number(payout.amount), payout.currency)}
          </span>
        ),
      },
      {
        key: "currency",
        header: "Currency",
        sortable: false,
        render: (payout) => (
          <span className="text-xs text-muted-foreground">{payout.currency}</span>
        ),
      },
      {
        key: "destinationType",
        header: "Type",
        sortable: false,
        render: (payout) => (
          <span className="text-xs text-muted-foreground">
            {String(payout.destinationType ?? "").replace("_", " ")}
          </span>
        ),
      },
      {
        key: "status",
        header: "Status",
        sortable: false,
        render: (payout) => (
          <PayoutStatusBadge status={(payout.status ?? "PENDING") as PayoutStatus} />
        ),
      },
      {
        key: "createdAt",
        header: "Date",
        sortable: false,
        render: (payout) => (
          <span className="text-sm text-muted-foreground">
            {new Date(String(payout.createdAt)).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        ),
      },
      {
        key: "actions",
        header: "",
        sortable: false,
        render: (payout) => (
          <div className="flex items-center gap-2">
            {payout.status === "FAILED" && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRetry(payout.id);
                }}
                disabled={retryMutation.isPending}
                className="flex items-center gap-1 rounded-sm px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50 dark:text-blue-400 dark:hover:bg-blue-950/50"
              >
                <ArrowCounterClockwise size={12} />
                Retry
              </button>
            )}
            {payout.status === "PENDING" && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancelClick(payout as Payout);
                }}
                disabled={cancelMutation.isPending}
                className="flex items-center gap-1 rounded-sm px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/50"
              >
                <Prohibit size={12} />
                Cancel
              </button>
            )}
          </div>
        ),
      },
    ],
    [retryMutation.isPending, cancelMutation.isPending]
  );

  // ── Derived Currencies ───────────────────────────────────────────────────────

  const availableCurrencies = useMemo(() => {
    const currencies = new Set<string>();
    payouts.forEach((p: Payout) => currencies.add(p.currency));
    return Array.from(currencies).sort();
  }, [payouts]);

  // ── Render ───────────────────────────────────────────────────────────────────

  const hasActiveFilters =
    status || destinationType || currency || dateFrom || dateTo || batchId || search;

  const filters = useMemo(
    () => ({
      status: status || undefined,
      destinationType: destinationType || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      batchId: batchId || undefined,
      search: search || undefined,
    }),
    [status, destinationType, dateFrom, dateTo, batchId, search]
  );

  return (
    <div className="space-y-8 dashboard-enter">
      <PageHeader
        eyebrow="Payouts"
        title={
          <>
            Send to{" "}
            <span className="editorial-italic text-muted-foreground">
              anyone, anywhere.
            </span>
          </>
        }
        description={
          isLoading
            ? "Loading…"
            : totalPayouts > 0
              ? `${totalPayouts.toLocaleString()} payouts across bank, mobile money, and crypto destinations.`
              : "Single or bulk to bank accounts, mobile money wallets, and self-custody crypto wallets."
        }
        actions={
          <PayoutExportButton
            payouts={payouts}
            isLoading={isLoading}
            filters={filters}
          />
        }
      />

      {/* ── Summary Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {isLoading ? (
          <>
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
          </>
        ) : (
          <>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Total Payouts</p>
              <p className="mt-2 text-2xl font-semibold">
                {totalPayouts.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="mt-2 text-2xl font-semibold text-amber-600">
                {payouts.filter((p: Payout) => p.status === "PENDING").length.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="mt-2 text-2xl font-semibold text-green-600">
                {payouts.filter((p: Payout) => p.status === "COMPLETED").length.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Failed</p>
              <p className="mt-2 text-2xl font-semibold text-red-600">
                {payouts.filter((p: Payout) => p.status === "FAILED").length.toLocaleString()}
              </p>
            </div>
          </>
        )}
      </div>

      {/* ── Search & Filters ───────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <PayoutSearchInput value={search} onSearch={handleSearch} />
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="groupByBatch"
              checked={groupByBatch}
              onChange={(e) => setGroupByBatch(e.target.checked)}
              className="rounded border-border"
            />
            <label htmlFor="groupByBatch" className="text-sm text-muted-foreground">
              Group by batch
            </label>
          </div>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <PayoutFilterBar
            onStatusChange={handleStatusChange}
            onDestinationTypeChange={handleDestinationTypeChange}
            onCurrencyChange={handleCurrencyChange}
            onDateRangeChange={handleDateRangeChange}
            onBatchIdChange={handleBatchIdChange}
            selectedStatus={status}
            selectedDestinationType={destinationType}
            selectedCurrency={currency}
            selectedBatchId={batchId}
            currencies={availableCurrencies}
          />
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={resetFilters}>
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────────── */}
      {error ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-red-600">Failed to load payouts</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
          <Button onClick={() => window.location.reload()} className="mt-4">
            Retry
          </Button>
        </div>
      ) : groupByBatch && groupedPayouts ? (
        <div className="space-y-4">
          {Array.from(groupedPayouts.batched.entries()).map(([bid, batchPayouts]) => (
            <div key={bid} className="space-y-2">
              <BatchGroupHeader
                batchId={bid}
                payouts={batchPayouts}
                isExpanded={expandedBatches.has(bid)}
                onToggle={() => toggleBatchExpansion(bid)}
              />
              {expandedBatches.has(bid) && (
                <div className="pl-4">
                  <DataTable<PayoutWithIndex>
                    columns={columns}
                    data={batchPayouts as PayoutWithIndex[]}
                    isLoading={false}
                    emptyMessage="No payouts in this batch"
                    onRowClick={handleRowClick}
                  />
                </div>
              )}
            </div>
          ))}
          {groupedPayouts.unbatched.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                Individual Payouts ({groupedPayouts.unbatched.length})
              </h3>
              <DataTable<PayoutWithIndex>
                columns={columns}
                data={groupedPayouts.unbatched as PayoutWithIndex[]}
                isLoading={isLoading}
                loadingRows={limit}
                emptyMessage="No payouts found"
                onRowClick={handleRowClick}
              />
            </div>
          )}
        </div>
      ) : (
        <DataTable<PayoutWithIndex>
          columns={columns}
          data={payouts as PayoutWithIndex[]}
          isLoading={isLoading}
          loadingRows={limit}
          emptyMessage={hasActiveFilters ? "No payouts match your filters" : "No payouts found"}
          emptyIcon={<Receipt size={48} className="text-muted-foreground" />}
          onRowClick={handleRowClick}
        />
      )}

      {!isLoading && payouts.length === 0 && hasActiveFilters && (
        <div className="text-center">
          <Button variant="outline" onClick={resetFilters}>
            Clear all filters
          </Button>
        </div>
      )}

      {!groupByBatch && (
        <Pagination
          page={Math.floor(offset / limit) + 1}
          totalPages={Math.ceil(totalPayouts / limit)}
          totalItems={totalPayouts}
          pageSize={limit}
          onPageChange={(page) => setOffset((page - 1) * limit)}
          onPageSizeChange={(size) => {
            setLimit(size);
            setOffset(0);
          }}
          pageSizeOptions={[10, 20, 50, 100]}
        />
      )}

      <PayoutDetailDrawer
        payout={selectedPayout}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onRetry={selectedPayout?.status === "FAILED" ? handleRetry : undefined}
        onCancel={selectedPayout?.status === "PENDING" ? (_id: string) => handleCancelClick(selectedPayout) : undefined}
        isRetrying={retryMutation.isPending}
        isCancelling={cancelMutation.isPending}
      />

      <CancelConfirmationModal
        open={cancelModalOpen}
        onOpenChange={setCancelModalOpen}
        onConfirm={handleCancelConfirm}
        isLoading={cancelMutation.isPending}
        recipientName={selectedPayout?.recipientName}
        amount={selectedPayout?.amount}
        currency={selectedPayout?.currency}
      />
    </div>
  );
}
