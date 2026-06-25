"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowRight,
  ArrowUpRight,
  Banknote,
  FileText,
  Globe,
  Link2,
  ScanLine,
  Wallet,
} from "lucide-react";
import { BrandLogo } from "./BrandLogo";

const ease = [0.22, 1, 0.36, 1] as const;

const features = [
  {
    icon: ScanLine,
    label: "Hosted checkout",
    desc: "Drop-in payment pages in your brand.",
  },
  {
    icon: Link2,
    label: "Pay by link",
    desc: "Share a URL, get paid in any currency.",
  },
  {
    icon: FileText,
    label: "Invoicing & subscriptions",
    desc: "Recurring billing on-chain or off-chain.",
  },
  {
    icon: Banknote,
    label: "Global payouts",
    desc: "Bank, card, or mobile in 174 countries.",
  },
  {
    icon: Wallet,
    label: "Multi-currency wallets",
    desc: "USDC, EURC, XLM and fiat — one balance.",
  },
  {
    icon: Globe,
    label: "FX & on/off-ramp",
    desc: "Convert at market rates, settle in seconds.",
  },
];

export function Features() {
  return (
    <section
      id="product"
      className="relative border-t border-rule pt-20 pb-20 md:pt-28 md:pb-28"
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
            <h2
              className="text-[34px] leading-[1.04] tracking-[-0.035em] text-ink md:text-[52px]"
              style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
            >
              Everything you need to{" "}
              <span className="editorial-italic text-ink-2">run</span> and{" "}
              <span className="editorial-italic text-accent">grow</span> your
              business.
            </h2>
            <p className="mt-5 max-w-[440px] text-[16px] leading-relaxed text-ink-2">
              One stack for payments, payouts, invoicing, FX, and treasury — so
              you don&apos;t stitch four vendors together to take a single
              dollar.
            </p>

            <ul className="mt-10 divide-y divide-rule border-y border-rule">
              {features.map((f, i) => (
                <motion.li
                  key={f.label}
                  initial={{ opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.55, delay: i * 0.05, ease }}
                  className="flex items-center gap-4 py-3.5"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full border border-rule bg-bg-card text-ink-2">
                    <f.icon className="size-4" strokeWidth={1.6} />
                  </span>
                  <span className="flex-1">
                    <span className="block text-[14px] font-medium text-ink">
                      {f.label}
                    </span>
                    <span className="block text-[13px] text-ink-3">
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
                  See all features
                  <ArrowRight className="size-4" strokeWidth={1.6} />
                </span>
              </Link>
              <Link
                href="/use-cases"
                className="group inline-flex items-center gap-1 text-[14px] text-ink-2 transition-colors hover:text-ink"
              >
                <span className="link-underline">Read use cases</span>
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

            <FeatureCard />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- */
function FeatureCard() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-rule bg-bg-card p-6 shadow-[0_40px_100px_-40px_rgba(14,14,12,0.28)] md:p-8">
      <div className="flex items-center justify-between">
        <span className="eyebrow inline-flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-accent" />
          Featured
        </span>
        <span
          className="text-[11px] uppercase tracking-[0.14em] text-ink-3"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Hosted checkout
        </span>
      </div>

      {/* Browser mock */}
      <div className="relative mt-6 overflow-hidden rounded-2xl border border-rule bg-bg-soft/40">
        <div className="flex items-center gap-2 border-b border-rule px-3 py-2">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-rule-2" />
            <span className="size-2 rounded-full bg-rule-2" />
            <span className="size-2 rounded-full bg-rule-2" />
          </span>
          <span
            className="ml-2 flex-1 truncate rounded-md bg-bg-card px-2.5 py-1 text-[11px] text-ink-3"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            buy.acme.com/checkout
          </span>
        </div>

        <div className="space-y-5 px-5 py-6 md:px-6">
          {/* Merchant header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="grid size-9 place-items-center rounded-xl bg-ink text-[14px] font-medium text-bg"
                style={{ fontFamily: "var(--font-display)" }}
              >
                A
              </div>
              <div>
                <div className="text-[13px] font-medium text-ink">
                  Acme Studio
                </div>
                <div className="text-[11px] text-ink-3">Pro plan · monthly</div>
              </div>
            </div>
            <div className="text-right">
              <div
                className="text-[18px] font-medium text-ink"
                style={{ fontFamily: "var(--font-display)" }}
              >
                $49.00
              </div>
              <div
                className="text-[10px] uppercase tracking-[0.14em] text-ink-3"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                USD
              </div>
            </div>
          </div>

          {/* Payment options */}
          <div className="space-y-2">
            <CheckoutMethod
              brand="usdc"
              label="USDC"
              sublabel="Stellar"
              amount="49.00 USDC"
              selected
            />
            <CheckoutMethod
              brand="visa"
              label="Card"
              sublabel="Visa · Mastercard"
              amount="$49.00"
            />
            <CheckoutMethod
              brand="bank"
              label="Bank transfer"
              sublabel="ACH · SEPA"
              amount="$49.00"
            />
          </div>

          {/* Pay button */}
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink py-3 text-[13px] font-medium text-bg transition hover:bg-[#1d1d23]"
          >
            Pay $49.00
            <ArrowRight className="size-4" strokeWidth={1.7} />
          </button>

          <div className="flex items-center justify-center gap-1.5 text-[10px] text-ink-3">
            <span
              className="uppercase tracking-[0.14em]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Powered by Useroutr
            </span>
            <span aria-hidden>·</span>
            <span>On-chain settlement</span>
          </div>
        </div>
      </div>

      {/* Footer caption */}
      <div className="mt-6">
        <h3
          className="text-[20px] leading-[1.15] tracking-[-0.025em] text-ink md:text-[22px]"
          style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
        >
          One link. <span className="editorial-italic text-ink-2">Any</span>{" "}
          currency. Any rail.
        </h3>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-3">
          Drop-in checkout that takes USDC, EURC, card, or bank — and settles to
          your treasury in seconds. Your branding, our routing.
        </p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- */
function CheckoutMethod({
  brand,
  label,
  sublabel,
  amount,
  selected,
}: {
  brand: string;
  label: string;
  sublabel: string;
  amount: string;
  selected?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border bg-bg-card px-3 py-2.5 transition ${
        selected
          ? "border-ink shadow-[0_0_0_3px_rgba(14,15,18,0.05)]"
          : "border-rule"
      }`}
    >
      <BrandLogo id={brand} size="sm" />
      <span className="flex-1">
        <span className="block text-[13px] font-medium text-ink">{label}</span>
        <span
          className="block text-[10px] uppercase tracking-[0.14em] text-ink-3"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {sublabel}
        </span>
      </span>
      <span
        className="text-[12px] text-ink"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {amount}
      </span>
      <span
        className={`grid size-4 place-items-center rounded-full border transition ${
          selected ? "border-ink bg-ink" : "border-rule-2"
        }`}
      >
        {selected && <span className="size-1.5 rounded-full bg-bg" />}
      </span>
    </div>
  );
}
