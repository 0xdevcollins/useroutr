"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BrandStatusBadge, type Tone } from "@/components/brand/StatusBadge";
import { formatCurrency } from "@/lib/utils";
import { formatDistanceToNowStrict } from "date-fns";
import type { TransactionStatus } from "@/hooks/useAnalytics";

// ── Skeleton ──────────────────────────────────────────────────────────────────

export function RecentTransactionsSkeleton() {
  return (
    <div className="surface">
      <div className="flex items-center justify-between border-b border-rule px-6 py-4">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="divide-hairline">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-6 py-3.5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="ml-auto h-4 w-16" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Status mapping ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<TransactionStatus, { label: string; tone: Tone }> = {
  COMPLETED: { label: "Completed", tone: "completed" },
  PROCESSING: { label: "Processing", tone: "processing" },
  PENDING: { label: "Pending", tone: "pending" },
  FAILED: { label: "Failed", tone: "failed" },
  CANCELLED: { label: "Cancelled", tone: "cancelled" },
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RecentTransaction {
  id: string;
  customer: string;
  amount: number;
  currency: string;
  status: TransactionStatus;
  createdAt: string;
}

// ── RecentTransactions ────────────────────────────────────────────────────────

interface RecentTransactionsProps {
  transactions: RecentTransaction[];
  highlightIds?: Set<string>;
}

export function RecentTransactions({
  transactions,
  highlightIds = new Set(),
}: RecentTransactionsProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="surface overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b border-rule px-6 py-4">
        <div>
          <span className="eyebrow">Recent transactions</span>
          <p
            className="mt-1.5 text-[18px] tracking-[-0.02em] text-foreground"
            style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
          >
            Last 24 hours
          </p>
        </div>
        <Link
          href="/payments"
          className="group inline-flex items-center gap-1 text-[13px] text-foreground"
        >
          <span className="link-underline">View all</span>
          <ArrowUpRight className="size-3.5 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      </div>

      {/* Body */}
      {transactions.length === 0 ? (
        <div className="px-6 py-14 text-center">
          <p className="text-[14px] font-medium text-foreground">
            No transactions yet
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Once a customer completes a checkout, every transaction lands here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[14px] tabular">
            <thead>
              <tr className="border-b border-rule">
                {["ID", "Customer", "Amount", "Status", "Time"].map((h) => (
                  <th
                    key={h}
                    className="px-6 py-3 text-left text-[10px] font-medium uppercase tracking-[0.12em] text-text-faint"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {transactions.map((tx) => {
                  const status = STATUS_CONFIG[tx.status];
                  const highlight = highlightIds.has(tx.id);
                  return (
                    <motion.tr
                      key={tx.id}
                      layout
                      initial={
                        highlight
                          ? {
                              backgroundColor:
                                "color-mix(in oklch, var(--accent) 14%, transparent)",
                            }
                          : { opacity: 0, y: 4 }
                      }
                      animate={{
                        opacity: 1,
                        y: 0,
                        backgroundColor: "transparent",
                      }}
                      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                      className="row-rule transition-colors hover:bg-secondary/40"
                    >
                      <td className="px-6 py-3.5">
                        <span
                          className="text-[12px] text-text-faint"
                          style={{ fontFamily: "var(--font-mono)" }}
                        >
                          {tx.id.slice(0, 8)}…
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-3.5 font-medium text-foreground">
                        {tx.customer}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3.5 text-foreground">
                        {formatCurrency(tx.amount, tx.currency)}
                      </td>
                      <td className="px-6 py-3.5">
                        <BrandStatusBadge
                          tone={status.tone}
                          pulse={tx.status === "PROCESSING"}
                        >
                          {status.label}
                        </BrandStatusBadge>
                      </td>
                      <td
                        className="whitespace-nowrap px-6 py-3.5 text-[12px] text-muted-foreground"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {formatDistanceToNowStrict(new Date(tx.createdAt), {
                          addSuffix: true,
                        })}
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}
    </motion.section>
  );
}
