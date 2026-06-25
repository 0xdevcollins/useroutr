"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { motion } from "motion/react";
import { DemoWidget } from "./DemoWidget";

interface HeroProps {
  onWaitlistClick: () => void;
}

const ease = [0.22, 1, 0.36, 1] as const;

const parent = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
const rise = {
  hidden: { opacity: 0, y: 14, filter: "blur(8px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.85, ease },
  },
};

export function Hero({ onWaitlistClick }: HeroProps) {
  return (
    <section className="relative overflow-hidden pt-16 pb-20 md:pt-24 md:pb-28">
      {/* Decorative line ornaments — Steep botanical move, rendered as soft hairlines */}
      <CornerOrnament className="pointer-events-none absolute left-6 top-6 hidden h-24 w-24 text-ink-3/40 md:block" />
      <CornerOrnament
        className="pointer-events-none absolute right-6 top-6 hidden h-24 w-24 text-ink-3/40 md:block"
        flip
      />

      <div className="container-x">
        {/* Copy */}
        <motion.div
          initial="hidden"
          animate="show"
          variants={parent}
          className="mx-auto max-w-[940px] text-center"
        >
          <motion.h1
            variants={rise}
            className="text-[42px] leading-[0.98] tracking-[-0.045em] text-ink sm:text-[56px] md:text-[76px] lg:text-[92px]"
            style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
          >
            <span className="block whitespace-nowrap">
              Cross-chain payments,
            </span>
            <span className="block whitespace-nowrap">
              <span className="editorial-italic text-accent">without</span> the
              custody.
            </span>
          </motion.h1>

          <motion.p
            variants={rise}
            className="mx-auto mt-8 max-w-[620px] text-[16px] leading-relaxed text-ink-2 md:text-[18px]"
          >
            One API for accepting and settling payments across chains. Built on
            Stellar.{" "}
            <span className="text-ink">
              Useroutr never holds the money in between.
            </span>
          </motion.p>

          <motion.div
            variants={rise}
            className="mt-10 flex flex-wrap items-center justify-center gap-3 md:gap-5"
          >
            <button type="button" onClick={onWaitlistClick} className="magnet">
              <span className="pill pill-accent">
                Open an account
                <ArrowRight className="size-4" strokeWidth={1.6} />
              </span>
            </button>
            <Link
              href="https://docs.useroutr.com"
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center gap-1.5 px-3 text-[14px] text-ink-2 transition-colors hover:text-ink"
            >
              <span className="link-underline">Read the docs</span>
              <ArrowUpRight
                className="size-3.5 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                strokeWidth={1.6}
              />
            </Link>
          </motion.div>
        </motion.div>

        {/* Interactive demo widget — replaces the static card+arc visual */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.95, delay: 0.5, ease }}
          className="relative mx-auto mt-16 md:mt-20"
        >
          <DemoWidget />
        </motion.div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- */
function CornerOrnament({
  className,
  flip,
}: {
  className?: string;
  flip?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      stroke="currentColor"
      strokeWidth="0.8"
      className={className}
      style={flip ? { transform: "scaleX(-1)" } : undefined}
      aria-hidden
    >
      <path d="M2 50 Q 2 2, 50 2" strokeLinecap="round" />
      <circle cx="2" cy="50" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="50" cy="2" r="1.4" fill="currentColor" stroke="none" />
      <path
        d="M14 38 Q 14 14, 38 14"
        strokeOpacity="0.55"
        strokeLinecap="round"
      />
    </svg>
  );
}
