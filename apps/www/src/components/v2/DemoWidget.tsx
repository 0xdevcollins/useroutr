"use client";

import { motion } from "motion/react";
import { Check, Loader2 } from "lucide-react";

const ease = [0.22, 1, 0.36, 1] as const;

type Row = {
  name: string;
  handle: string;
  amount: string;
  rail: string;
  status: "completed" | "processing";
  time?: string;
};

const rows: Row[] = [
  {
    name: "Adaeze O.",
    handle: "GTBank ···4021",
    amount: "₦240,000",
    rail: "Bank",
    status: "completed",
    time: "2m 41s",
  },
  {
    name: "Emeka N.",
    handle: "MTN ···8813",
    amount: "₦85,500",
    rail: "Mobile money",
    status: "completed",
    time: "0m 52s",
  },
  {
    name: "Fatima B.",
    handle: "Opay ···5567",
    amount: "₦120,000",
    rail: "Mobile money",
    status: "completed",
    time: "1m 18s",
  },
  {
    name: "Chidi A.",
    handle: "Access ···9930",
    amount: "₦310,000",
    rail: "Bank",
    status: "processing",
  },
];

export function DemoWidget() {
  return (
    <div className="mx-auto w-full max-w-[720px]">
      <div className="overflow-hidden rounded-3xl border border-rule bg-bg-card shadow-[0_50px_120px_-50px_rgba(14,14,12,0.35)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-rule px-5 py-4 md:px-6">
          <div className="flex items-center gap-2.5">
            <span
              className="text-[11px] uppercase tracking-[0.14em] text-ink-3"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Payout batch · payroll_2026_07
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-bg px-2.5 py-1 text-[11px] text-ink-2">
            <span className="size-1.5 rounded-full bg-[#1f6c43] pulse-soft" />
            <span style={{ fontFamily: "var(--font-mono)" }}>Settling</span>
          </span>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 divide-x divide-rule border-b border-rule">
          <Stat label="Recipients" value="248" />
          <Stat label="Source" value="USDC · Stellar" />
          <Stat label="Settle to" value="₦ NGN" />
        </div>

        {/* Rows */}
        <div className="divide-y divide-rule">
          {rows.map((r, i) => (
            <motion.div
              key={r.name}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.6 + i * 0.12, ease }}
              className="flex items-center gap-3 px-5 py-3.5 md:px-6"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full border border-rule bg-bg text-[13px] font-medium text-ink">
                {r.name.charAt(0)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-medium text-ink">
                  {r.name}
                </span>
                <span
                  className="block truncate text-[11px] text-ink-3"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {r.handle} · {r.rail}
                </span>
              </span>
              <span className="text-right">
                <span
                  className="block text-[13.5px] text-ink"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {r.amount}
                </span>
              </span>
              <span className="ml-1 w-[112px] shrink-0 text-right">
                {r.status === "completed" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eaf5ee] px-2.5 py-1 text-[11px] font-medium text-[#1f6c43]">
                    <Check className="size-3" strokeWidth={2.4} />
                    {r.time}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-bg-soft px-2.5 py-1 text-[11px] font-medium text-ink-3">
                    <Loader2 className="size-3 animate-spin" strokeWidth={2} />
                    Processing
                  </span>
                )}
              </span>
            </motion.div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-rule px-5 py-3.5 md:px-6">
          <span className="text-[12px] text-ink-3">
            245 delivered · 3 processing
          </span>
          <span
            className="text-[11px] uppercase tracking-[0.14em] text-ink-3"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Settled on Stellar
          </span>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-4 md:px-6">
      <div
        className="text-[10px] uppercase tracking-[0.14em] text-ink-3"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {label}
      </div>
      <div
        className="mt-1 text-[15px] text-ink md:text-[16px]"
        style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
      >
        {value}
      </div>
    </div>
  );
}
