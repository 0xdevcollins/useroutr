"use client";

import { motion } from "motion/react";
import { BrandLogo } from "./BrandLogo";
import { BRAND_LOGOS } from "@/lib/brand-logos";

interface RailItem {
  /** BrandLogo id — looked up in BRAND_LOGOS. */
  id: string;
  /**
   * Optional label override. Useful when the product name differs from the
   * brand mark — e.g. "Visa Direct" maps to the plain `visa` logo, "Stripe
   * Treasury" maps to the plain `stripe` logo. Falls back to BRAND_LOGOS[id].label.
   */
  label?: string;
}

const accept: RailItem[] = [
  { id: "stellar", label: "Stellar" },
  { id: "usdc" },
  { id: "eurc" },
  { id: "xlm" },
  { id: "soroban", label: "Soroban" },
  { id: "circle", label: "Circle CCTP V2" },
  { id: "sol", label: "Solana" },
  { id: "polygon", label: "Polygon" },
  { id: "eth", label: "Ethereum" },
];

const settle: RailItem[] = [
  { id: "ach", label: "Bank · ACH" },
  { id: "swift", label: "SWIFT" },
  { id: "sepa", label: "SEPA" },
  { id: "visa", label: "Visa Direct" },
  { id: "mastercard", label: "Mastercard Send" },
  { id: "moneygram", label: "MoneyGram" },
  { id: "mpesa", label: "M-Pesa" },
  { id: "wise", label: "Wise" },
  { id: "stripe-treasury", label: "Stripe Treasury" },
];

const ease = [0.22, 1, 0.36, 1] as const;

export function TrustStrip() {
  const acceptTrack = [...accept, ...accept];
  const settleTrack = [...settle, ...settle];

  return (
    <section className="relative border-t border-b border-rule bg-accent-tint pt-20 pb-20 md:pt-28 md:pb-28">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7, ease }}
        className="container-x"
      >
        <div className="mx-auto max-w-[760px] text-center">
          <h2
            className="text-[28px] leading-[1.05] tracking-[-0.035em] text-ink md:text-[42px]"
            style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
          >
            Accept <span className="editorial-italic text-ink-2">anything</span>
            . Settle{" "}
            <span className="editorial-italic text-accent">anywhere</span>.
          </h2>
          <p className="mx-auto mt-4 max-w-[480px] text-[15px] leading-relaxed text-ink-2">
            Take paymentss in dozens of currencies and networks. Deliver to the
            rail your business already runs on.
          </p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.9, delay: 0.15, ease }}
        className="mt-14 space-y-8 md:mt-20 md:space-y-12"
      >
        <Row label="Accept in" items={acceptTrack} />

        <div className="container-x">
          <div className="mx-auto flex max-w-[360px] items-center gap-3">
            <span className="h-px flex-1 bg-ink/15" />
            <span className="eyebrow whitespace-nowrap text-ink-3">
              Bridged in seconds, not minutes
            </span>
            <span className="h-px flex-1 bg-ink/15" />
          </div>
        </div>

        <Row label="Settle to" items={settleTrack} reverse />
      </motion.div>
    </section>
  );
}

function Row({
  label,
  items,
  reverse,
}: {
  label: string;
  items: RailItem[];
  reverse?: boolean;
}) {
  return (
    <div>
      <div className="container-x mb-3">
        <span className="eyebrow">{label}</span>
      </div>
      <div className="marquee-mask overflow-hidden">
        <div
          className="marquee-track"
          style={{ animationDirection: reverse ? "reverse" : "normal" }}
        >
          {items.map((item, i) => {
            const entry = BRAND_LOGOS[item.id];
            const label = item.label ?? entry?.label ?? item.id;
            const lockup = entry?.srcLockup;

            return (
              <span
                key={`${item.id}-${i}`}
                className="mr-10 inline-flex shrink-0 items-center gap-4 md:mr-14"
              >
                {lockup ? (
                  /* Brand has an official wordmark lockup — render alone, no
                     duplicate text label. Heights tuned so the lockup feels
                     proportional next to icon+text neighbors. */
                  <span className="grid h-9 place-items-center rounded-full border border-ink/10 bg-bg-card px-4 shadow-[0_2px_10px_-6px_rgba(14,14,12,0.18)] md:h-12 md:px-5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={lockup}
                      alt={label}
                      className="h-5 w-auto md:h-6"
                      loading="lazy"
                    />
                  </span>
                ) : (
                  <>
                    <span className="grid size-10 place-items-center rounded-full border border-ink/10 bg-bg-card shadow-[0_2px_10px_-6px_rgba(14,14,12,0.18)] md:size-12">
                      <BrandLogo id={item.id} size="sm" />
                    </span>
                    <span
                      className="text-[22px] tracking-[-0.025em] text-ink md:text-[28px]"
                      style={{
                        fontFamily: "var(--font-display)",
                        fontWeight: 500,
                      }}
                    >
                      {label}
                    </span>
                  </>
                )}
                <span
                  aria-hidden
                  className="text-ink-4"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  ·
                </span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
