"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowRight,
  ArrowUpRight,
  Code2,
  Package,
  Users,
  LayoutDashboard,
} from "lucide-react";

const ease = [0.22, 1, 0.36, 1] as const;

const surfaces = [
  {
    icon: Code2,
    label: "API",
    desc: "Quotes, payments, payouts, recipients, webhooks. Idempotent, predictable, versioned.",
  },
  {
    icon: Package,
    label: "TypeScript SDK + checkout",
    desc: "A typed client and an embeddable checkout modal. Payers never need XLM — fees are sponsored.",
  },
  {
    icon: Users,
    label: "Bulk payouts",
    desc: "Pay 1 or 10,000 recipients in one request. Saved recipients, scheduling, honest failure reasons.",
  },
  {
    icon: LayoutDashboard,
    label: "Dashboard",
    desc: "Balances, payouts, recipients, API keys, webhook logs — for the operator who runs the disbursement.",
  },
];

export function Features() {
  return (
    <section
      id="product"
      className="relative border-b border-rule pt-20 pb-20 md:pt-28 md:pb-28"
    >
      <div className="container-x">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 md:gap-16 lg:gap-20">
          {/* Left — the index */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease }}
          >
            <span className="eyebrow">What you get</span>
            <h2
              className="mt-4 text-[34px] leading-[1.04] tracking-[-0.035em] text-ink md:text-[52px]"
              style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
            >
              One stack to{" "}
              <span className="editorial-italic text-accent">pay</span> anyone,
              anywhere.
            </h2>
            <p className="mt-5 max-w-[440px] text-[16px] leading-relaxed text-ink-2">
              An API, an SDK, and a dashboard — so a developer ships payouts in
              an afternoon and a finance operator runs them every week.
            </p>

            <ul className="mt-10 divide-y divide-rule border-y border-rule">
              {surfaces.map((f, i) => (
                <motion.li
                  key={f.label}
                  initial={{ opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.55, delay: i * 0.05, ease }}
                  className="flex items-start gap-4 py-4"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full border border-rule bg-bg-card text-ink-2">
                    <f.icon className="size-4" strokeWidth={1.6} />
                  </span>
                  <span className="flex-1">
                    <span className="block text-[14px] font-medium text-ink">
                      {f.label}
                    </span>
                    <span className="block text-[13px] leading-relaxed text-ink-3">
                      {f.desc}
                    </span>
                  </span>
                </motion.li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap items-center gap-5">
              <Link
                href="https://docs.useroutr.com"
                target="_blank"
                rel="noreferrer"
                className="magnet"
              >
                <span className="pill pill-dark py-3 text-[13px]">
                  Explore the docs
                  <ArrowRight className="size-4" strokeWidth={1.6} />
                </span>
              </Link>
              <Link
                href="/pricing"
                className="group inline-flex items-center gap-1 text-[14px] text-ink-2 transition-colors hover:text-ink"
              >
                <span className="link-underline">See pricing</span>
                <ArrowUpRight
                  className="size-3.5 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  strokeWidth={1.6}
                />
              </Link>
            </div>
          </motion.div>

          {/* Right — the featured product card */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.8, delay: 0.15, ease }}
            className="relative"
          >
            {/* soft halo */}
            <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 size-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-soft/40 blur-3xl md:size-[560px]" />

            <PayoutCard />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- */
function PayoutCard() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-rule bg-bg-card p-6 shadow-[0_40px_100px_-40px_rgba(14,14,12,0.28)] md:p-8">
      <div className="flex items-center justify-between">
        <span className="eyebrow inline-flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-accent" />
          Send a payout
        </span>
        <span
          className="text-[11px] uppercase tracking-[0.14em] text-ink-3"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          New recipient
        </span>
      </div>

      {/* Payout form mock */}
      <div className="relative mt-6 space-y-4 rounded-2xl border border-rule bg-bg-soft/40 px-5 py-6 md:px-6">
        <Field label="Recipient" value="Adaeze Okafor" />
        <Field label="Destination" value="GTBank · ···4021" mono />
        <div className="grid grid-cols-2 gap-3">
          <Field label="You send" value="150.00 USDC" mono />
          <Field label="They receive" value="₦240,000" mono accent />
        </div>

        {/* Quote transparency */}
        <div className="rounded-xl border border-rule bg-bg-card px-4 py-3">
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-ink-3">Useroutr rate</span>
            <span className="text-ink" style={{ fontFamily: "var(--font-mono)" }}>
              0.8% + $0.20
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[12px]">
            <span className="text-ink-3">Mid-market FX</span>
            <span
              className="text-ink-3"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              ₦1,601.40 / $
            </span>
          </div>
        </div>

        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink py-3 text-[13px] font-medium text-bg transition hover:bg-[#1d1d23]"
        >
          Send ₦240,000
          <ArrowRight className="size-4" strokeWidth={1.7} />
        </button>

        <div className="flex items-center justify-center gap-1.5 text-[10px] text-ink-3">
          <span
            className="uppercase tracking-[0.14em]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Delivered in minutes
          </span>
          <span aria-hidden>·</span>
          <span>Settled on Stellar</span>
        </div>
      </div>

      {/* Footer caption */}
      <div className="mt-6">
        <h3
          className="text-[20px] leading-[1.15] tracking-[-0.025em] text-ink md:text-[22px]"
          style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
        >
          One request.{" "}
          <span className="editorial-italic text-ink-2">Any</span> recipient.
          Local rails.
        </h3>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-3">
          Save a recipient once, then pay them — or ten thousand of them — to a
          bank account or mobile money wallet. Every quote shows the mid-market
          rate next to ours.
        </p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- */
function Field({
  label,
  value,
  mono,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-rule bg-bg-card px-4 py-2.5">
      <div
        className="text-[10px] uppercase tracking-[0.14em] text-ink-3"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {label}
      </div>
      <div
        className={`mt-0.5 text-[14px] ${accent ? "text-accent-ink" : "text-ink"}`}
        style={mono ? { fontFamily: "var(--font-mono)" } : undefined}
      >
        {value}
      </div>
    </div>
  );
}
