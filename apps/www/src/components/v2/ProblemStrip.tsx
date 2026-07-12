"use client";

import { motion } from "motion/react";

const ease = [0.22, 1, 0.36, 1] as const;

export function ProblemStrip() {
  return (
    <section className="border-t border-b border-rule bg-accent-tint py-20 md:py-28">
      <div className="container-x">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease }}
          className="mx-auto max-w-[820px] text-center"
        >
          <h2
            className="text-[28px] leading-[1.08] tracking-[-0.035em] text-ink md:text-[44px]"
            style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
          >
            Paying sellers, workers, and suppliers across borders still costs{" "}
            <span className="editorial-italic text-accent">3–8%</span> and takes
            days.
          </h2>
          <p className="mx-auto mt-6 max-w-[600px] text-[16px] leading-relaxed text-ink-2 md:text-[18px]">
            Stablecoins fixed the middle of the journey. Useroutr fixes the last
            mile — the part where money becomes spendable in a local account.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
