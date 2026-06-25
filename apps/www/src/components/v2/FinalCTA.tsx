"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, ArrowUpRight } from "lucide-react";

const ease = [0.22, 1, 0.36, 1] as const;

interface FinalCTAProps {
  onWaitlistClick: () => void;
}

export function FinalCTA({ onWaitlistClick }: FinalCTAProps) {
  return (
    <section className="relative overflow-hidden bg-accent text-ink">
      {/* Texture: hairline grid + radial washes */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(14,15,18,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(14,15,18,0.5) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
        <div className="absolute left-1/2 top-0 size-[1100px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/30 blur-3xl" />
        <div className="absolute bottom-0 right-0 size-[520px] translate-x-1/3 translate-y-1/3 rounded-full bg-black/15 blur-3xl" />
      </div>

      <div className="container-x relative z-10 py-32 md:py-40 lg:py-48">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease }}
          className="mx-auto max-w-[1000px] text-center"
        >
          <h2
            className="text-[48px] leading-[0.98] tracking-[-0.045em] text-ink md:text-[96px] lg:text-[128px]"
            style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
          >
            Start accepting payments{" "}
            <span
              className="text-ink/85"
              style={{
                fontFamily: "var(--font-fraunces)",
                fontStyle: "italic",
                fontWeight: 400,
                letterSpacing: "-0.025em",
                fontVariationSettings: '"opsz" 144, "SOFT" 50',
              }}
            >
              today
            </span>
            .
          </h2>
          <p className="mx-auto mt-8 max-w-[560px] text-[17px] leading-relaxed text-ink/80 md:text-[20px]">
            Open a Useroutr account in 60 seconds. No setup fees. Cancel anytime
            — and your funds are always yours.
          </p>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-3 md:gap-5">
            <button type="button" onClick={onWaitlistClick} className="magnet">
              <span
                className="pill"
                style={{
                  background: "var(--ink)",
                  color: "#ffffff",
                  fontWeight: 600,
                }}
              >
                Open an account
                <ArrowRight className="size-4" strokeWidth={1.7} />
              </span>
            </button>
            <Link
              href="https://docs.useroutr.com"
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center gap-1.5 px-3 text-[14px] text-ink/80 transition-colors hover:text-ink"
            >
              <span className="link-underline">Read the docs</span>
              <ArrowUpRight
                className="size-3.5 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                strokeWidth={1.6}
              />
            </Link>
          </div>

          <div className="mt-12 inline-flex items-center gap-2.5 rounded-full border border-ink/15 bg-ink/5 px-3.5 py-1.5 text-[11.5px] text-ink/80 backdrop-blur-sm">
            <span className="size-1.5 rounded-full bg-[#1f6c43] pulse-soft" />
            <span
              className="uppercase tracking-[0.14em]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Live on Stellar mainnet
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
