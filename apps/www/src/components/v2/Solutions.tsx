"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowRight,
  ArrowUpRight,
  Copy,
  FileText,
  Link2,
  ScanLine,
  TrendingUp,
} from "lucide-react";

const ease = [0.22, 1, 0.36, 1] as const;

export function Solutions() {
  return (
    <section
      id="solutions"
      className="relative border-t border-rule pt-20 pb-20 md:pt-28 md:pb-28"
    >
      <div className="container-x space-y-24 md:space-y-32">
        <RevenueRow />
        <NoCodeRow />
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- */
function RevenueRow() {
  return (
    <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-12 md:gap-16">
      {/* Text */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7, ease }}
        className="md:col-span-5"
      >
        <h2
          className="text-[32px] leading-[1.05] tracking-[-0.035em] text-ink md:text-[48px]"
          style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
        >
          Raise revenue{" "}
          <span className="editorial-italic text-ink-2">without</span> changing
          your stack.
        </h2>
        <p className="mt-5 max-w-[440px] text-[16px] leading-relaxed text-ink-2">
          Plug Useroutr into your existing AR or marketplace flow. Collect in
          dozens of currencies, deliver to the bank you already use, and watch
          DSO drop.
        </p>

        <ul className="mt-8 space-y-2.5">
          {[
            "Same-day settlement on cross-border invoices",
            "Multi-party splits for marketplaces",
            "Automatic FX at market rates",
            "Reconciliation that ties to your ledger",
          ].map((line) => (
            <li
              key={line}
              className="flex items-start gap-2.5 text-[14px] text-ink-2"
            >
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-accent" />
              <span>{line}</span>
            </li>
          ))}
        </ul>

        <div className="mt-9">
          <Link
            href="/use-cases"
            className="group inline-flex items-center gap-1 text-[14px] text-ink-2 transition-colors hover:text-ink"
          >
            <span className="link-underline">See finance use cases</span>
            <ArrowUpRight
              className="size-3.5 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              strokeWidth={1.6}
            />
          </Link>
        </div>
      </motion.div>

      {/* Visual */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.8, delay: 0.15, ease }}
        className="relative md:col-span-7"
      >
        <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 size-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-soft/40 blur-3xl md:size-[560px]" />
        <RevenueVisual />
      </motion.div>
    </div>
  );
}

function RevenueVisual() {
  const stats = [
    { label: "Faster collections", value: "+67%", caption: "DSO 41d → 14d" },
    { label: "Cross-border fee", value: "$0.0001", caption: "vs $25 wire" },
    { label: "Avg settlement", value: "2.3s", caption: "End to end" },
    {
      label: "Countries reachable",
      value: "174",
      caption: "Bank · mobile · card",
    },
  ];

  return (
    <div className="overflow-hidden rounded-3xl border border-rule bg-bg-card p-6 shadow-[0_40px_100px_-40px_rgba(14,14,12,0.28)] md:p-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="grid size-8 place-items-center rounded-lg bg-ink text-bg"
            style={{ fontFamily: "var(--font-display)" }}
          >
            <TrendingUp className="size-4" strokeWidth={1.8} />
          </div>
          <div>
            <div className="text-[13px] font-medium text-ink">
              Treasury · Q1 vs Q4
            </div>
            <div
              className="text-[11px] text-ink-3"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              avg across 124 customers
            </div>
          </div>
        </div>
        <span className="rounded-full bg-[#e6f4ec] px-2.5 py-1 text-[11px] font-medium text-[#1f6c43]">
          ↑ Switched to Useroutr
        </span>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-rule bg-bg-soft/40 px-4 py-4"
          >
            <div
              className="text-[10px] uppercase tracking-[0.14em] text-ink-3"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {s.label}
            </div>
            <div
              className="mt-2 text-[28px] leading-none tracking-[-0.03em] text-ink"
              style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
            >
              {s.value}
            </div>
            <div
              className="mt-1.5 text-[11px] text-ink-3"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {s.caption}
            </div>
          </div>
        ))}
      </div>

      {/* Sparkline footer */}
      <div className="mt-6 border-t border-rule pt-5">
        <div className="flex items-baseline justify-between">
          <span
            className="text-[11px] uppercase tracking-[0.14em] text-ink-3"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            12-week revenue trend
          </span>
          <span
            className="text-[13px] font-medium text-[#1f6c43]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            +42.8%
          </span>
        </div>
        <Sparkline />
      </div>
    </div>
  );
}

function Sparkline() {
  // Hand-picked monotonic upward trend
  const heights = [22, 28, 24, 36, 32, 44, 48, 42, 56, 60, 58, 72];
  return (
    <div className="mt-3 flex items-end gap-1.5">
      {heights.map((h, i) => (
        <motion.span
          key={i}
          initial={{ scaleY: 0 }}
          whileInView={{ scaleY: 1 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, delay: 0.05 * i, ease }}
          className={`origin-bottom flex-1 rounded-sm ${i === heights.length - 1 ? "bg-accent" : "bg-rule-2"}`}
          style={{ height: `${h}px` }}
        />
      ))}
    </div>
  );
}

/* ---------------------------------------------------------- */
function NoCodeRow() {
  return (
    <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-12 md:gap-16">
      {/* Visual — order reversed on desktop */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.8, ease }}
        className="relative md:order-1 md:col-span-7"
      >
        <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 size-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-soft/40 blur-3xl md:size-[560px]" />
        <NoCodeVisual />
      </motion.div>

      {/* Text */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7, delay: 0.1, ease }}
        className="md:order-2 md:col-span-5"
      >
        <h2
          className="text-[32px] leading-[1.05] tracking-[-0.035em] text-ink md:text-[48px]"
          style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
        >
          No engineers?{" "}
          <span className="editorial-italic text-accent">No problem.</span>
        </h2>
        <p className="mt-5 max-w-[440px] text-[16px] leading-relaxed text-ink-2">
          Take payments from the dashboard in three clicks. Pay-by-link,
          invoices, and hosted checkout — no SDK, no devops, nothing to deploy.
        </p>

        <div className="mt-8 space-y-2.5">
          {[
            {
              icon: Link2,
              label: "Pay by link",
              desc: "Send a URL, get paid.",
            },
            {
              icon: FileText,
              label: "Invoices",
              desc: "Recurring or one-off.",
            },
            {
              icon: ScanLine,
              label: "Hosted checkout",
              desc: "Embed in your site.",
            },
          ].map((row) => (
            <div
              key={row.label}
              className="flex items-center gap-3 rounded-2xl border border-rule bg-bg-card px-4 py-3"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-bg-soft text-ink-2">
                <row.icon className="size-4" strokeWidth={1.6} />
              </span>
              <span className="flex-1">
                <span className="block text-[14px] font-medium text-ink">
                  {row.label}
                </span>
                <span className="block text-[12px] text-ink-3">{row.desc}</span>
              </span>
            </div>
          ))}
        </div>

        <div className="mt-9">
          <Link
            href="https://docs.useroutr.com/no-code"
            target="_blank"
            rel="noreferrer"
            className="group inline-flex items-center gap-1 text-[14px] text-ink-2 transition-colors hover:text-ink"
          >
            <span className="link-underline">Start in the dashboard</span>
            <ArrowRight
              className="size-3.5 transition group-hover:translate-x-0.5"
              strokeWidth={1.6}
            />
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

function NoCodeVisual() {
  return (
    <div className="overflow-hidden rounded-3xl border border-rule bg-bg-card p-6 shadow-[0_40px_100px_-40px_rgba(14,14,12,0.28)] md:p-8">
      <div className="flex items-center justify-between">
        <span
          className="text-[11px] uppercase tracking-[0.14em] text-ink-3"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          New payment link
        </span>
        <span
          className="text-[11px] text-ink-3"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          dashboard ›
        </span>
      </div>

      {/* Form-ish preview */}
      <div className="mt-5 space-y-3">
        <FormRow label="Description" value="Pro plan · annual" />
        <div className="grid grid-cols-2 gap-3">
          <FormRow label="Amount" value="$588.00" mono />
          <FormRow label="Currency" value="USD" mono />
        </div>
        <FormRow label="Customer" value="alex@acmestudio.co" />
      </div>

      {/* Generated link card */}
      <div className="mt-6 rounded-2xl border border-ink bg-bg p-4 shadow-[0_0_0_3px_rgba(14,15,18,0.04)]">
        <div className="flex items-center justify-between">
          <span
            className="text-[10px] uppercase tracking-[0.14em] text-ink-3"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Live link
          </span>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full border border-rule bg-bg-card px-2 py-1 text-[10px] text-ink-2 hover:border-ink hover:text-ink"
          >
            <Copy className="size-3" strokeWidth={1.6} />
            Copy
          </button>
        </div>
        <div
          className="mt-2 truncate text-[14px] font-medium text-ink"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          useroutr.com/pay/4f9a-acme
        </div>
        <div className="mt-3 grid grid-cols-[auto_1fr] items-center gap-3">
          <QrPreview />
          <div>
            <div className="text-[12px] text-ink">
              Send by email, SMS, or QR.
            </div>
            <div className="text-[11px] text-ink-3">
              Customer pays in any currency.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FormRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-rule bg-bg-soft/40 px-4 py-3">
      <div
        className="text-[10px] uppercase tracking-[0.14em] text-ink-3"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {label}
      </div>
      <div
        className={`mt-1 text-[14px] font-medium text-ink ${mono ? "" : ""}`}
        style={mono ? { fontFamily: "var(--font-mono)" } : undefined}
      >
        {value}
      </div>
    </div>
  );
}

function QrPreview() {
  // 5x5 deterministic checker pattern; faux QR
  const cells = Array.from({ length: 25 }, (_, i) => {
    // Hardcoded pattern so it looks QR-ish but doesn't actually encode anything
    const pat = [
      1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1,
    ];
    return pat[i] === 1;
  });
  return (
    <div className="grid size-16 grid-cols-5 gap-[2px] rounded-md bg-bg-card p-1.5 ring-1 ring-rule">
      {cells.map((on, i) => (
        <span
          key={i}
          className={`rounded-[1px] ${on ? "bg-ink" : "bg-transparent"}`}
        />
      ))}
    </div>
  );
}
