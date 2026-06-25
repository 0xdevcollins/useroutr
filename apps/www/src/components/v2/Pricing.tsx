"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, ArrowUpRight, Check } from "lucide-react";

const ease = [0.22, 1, 0.36, 1] as const;

interface PricingProps {
  onWaitlistClick: () => void;
}

const selfServeFeatures = [
  "All chains and rails included",
  "Hosted checkout + Pay by link",
  "Dashboard, API, webhooks",
  "Payouts in 174 countries",
  "Standard support",
];

const enterpriseFeatures = [
  "Everything in Self-serve",
  "Volume pricing tiers",
  "Dedicated routing & settlement",
  "White-label checkout",
  "99.99% SLA · dedicated team",
];

export function Pricing({ onWaitlistClick }: PricingProps) {
  return (
    <section
      id="pricing"
      className="relative border-t border-rule pt-20 pb-20 md:pt-28 md:pb-28"
    >
      <div className="container-x">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease }}
          className="mx-auto max-w-[720px] text-center"
        >
          <h2
            className="text-[34px] leading-[1.04] tracking-[-0.035em] text-ink md:text-[52px]"
            style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
          >
            Transparent pricing.{" "}
            <span className="editorial-italic text-accent">No surprises</span>.
          </h2>
          <p className="mx-auto mt-5 max-w-[520px] text-[16px] leading-relaxed text-ink-2">
            One simple rate. No monthly fees. Volume discounts kick in
            automatically as you grow.
          </p>
        </motion.div>

        <div className="mx-auto mt-14 grid max-w-[960px] grid-cols-1 gap-5 md:mt-20 md:grid-cols-2">
          {/* Self-serve — highlighted */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease }}
            className="relative"
          >
            <PricingCard
              variant="primary"
              badge="Most popular"
              name="Self-serve"
              priceLead="0.5%"
              priceUnit="per transaction"
              priceCaption="$0/mo · No setup · Cancel anytime"
              features={selfServeFeatures}
              cta={
                <button
                  type="button"
                  onClick={onWaitlistClick}
                  className="magnet w-full"
                >
                  <span className="pill pill-accent w-full justify-center py-3 text-[13px]">
                    Open an account
                    <ArrowRight className="size-4" strokeWidth={1.6} />
                  </span>
                </button>
              }
            />
          </motion.div>

          {/* Enterprise */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, delay: 0.1, ease }}
          >
            <PricingCard
              variant="ghost"
              name="Enterprise"
              priceLead="Custom"
              priceUnit="for $1M+/mo volume"
              priceCaption="Volume tiers · Dedicated team"
              features={enterpriseFeatures}
              cta={
                <Link
                  href="mailto:sales@useroutr.com?subject=Useroutr%20enterprise"
                  className="w-full"
                >
                  <span className="pill pill-light w-full justify-center py-3 text-[13px]">
                    Talk to sales
                    <ArrowUpRight className="size-4" strokeWidth={1.6} />
                  </span>
                </Link>
              }
            />
          </motion.div>
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, delay: 0.25, ease }}
          className="mx-auto mt-10 max-w-[560px] text-center text-[13px] text-ink-3"
        >
          Network fees (Stellar, Visa, ACH, etc.) are passed through at cost —
          no markup. See the full breakdown on the{" "}
          <Link
            href="/pricing"
            className="text-ink-2 underline decoration-rule-2 decoration-from-font underline-offset-4 hover:text-ink"
          >
            pricing page
          </Link>
          .
        </motion.p>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- */
function PricingCard({
  variant,
  badge,
  name,
  priceLead,
  priceUnit,
  priceCaption,
  features,
  cta,
}: {
  variant: "primary" | "ghost";
  badge?: string;
  name: string;
  priceLead: string;
  priceUnit: string;
  priceCaption: string;
  features: string[];
  cta: React.ReactNode;
}) {
  const isPrimary = variant === "primary";
  return (
    <div
      className={`relative h-full overflow-hidden rounded-3xl p-7 md:p-8 ${
        isPrimary
          ? "border border-accent bg-bg-card shadow-[0_40px_100px_-40px_rgba(255,91,31,0.32)]"
          : "border border-rule bg-bg-card/60"
      }`}
    >
      {badge && (
        <span
          className="absolute right-6 top-6 rounded-full bg-accent px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {badge}
        </span>
      )}

      <span
        className="text-[11px] uppercase tracking-[0.14em] text-ink-3"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {name}
      </span>

      <div className="mt-5">
        <div className="flex items-baseline gap-2">
          <span
            className="text-[56px] leading-none tracking-[-0.04em] text-ink"
            style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
          >
            {priceLead}
          </span>
          <span className="text-[13px] text-ink-3">{priceUnit}</span>
        </div>
        <div className="mt-2 text-[13px] text-ink-3">{priceCaption}</div>
      </div>

      <div className="my-7 h-px bg-rule" />

      <ul className="space-y-2.5">
        {features.map((f) => (
          <li
            key={f}
            className="flex items-start gap-2.5 text-[14px] text-ink-2"
          >
            <span
              className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full ${
                isPrimary ? "bg-accent text-ink" : "bg-bg-soft text-ink-2"
              }`}
            >
              <Check className="size-2.5" strokeWidth={2.6} />
            </span>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div className="mt-8">{cta}</div>
    </div>
  );
}
