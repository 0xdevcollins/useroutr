"use client";

import { motion } from "motion/react";
import { ArrowDownToLine, ShieldCheck, Send } from "lucide-react";

const ease = [0.22, 1, 0.36, 1] as const;

const steps = [
  {
    n: "01",
    icon: ArrowDownToLine,
    title: "Money in",
    body: "Fund payouts with USDC from Ethereum, Base, or Stellar — from your treasury or straight from your customers through our checkout. One API call or one embed. No cards required.",
  },
  {
    n: "02",
    icon: ShieldCheck,
    title: "Settled on Stellar",
    body: "Funds land in an open-source escrow smart contract and convert to your settlement currency at a locked quote. Settlement completes or funds are refunded — enforced by the contract, not by a promise. Fees are under a cent; finality takes seconds.",
  },
  {
    n: "03",
    icon: Send,
    title: "Money out",
    body: "Recipients are paid to bank accounts and mobile money wallets through regulated local partners. You get one webhook when the money is spendable — not when we “initiated” it.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-b border-rule py-20 md:py-28">
      <div className="container-x">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease }}
          className="max-w-[720px]"
        >
          <span className="eyebrow">How it works</span>
          <h2
            className="mt-4 text-[34px] leading-[1.04] tracking-[-0.035em] text-ink md:text-[52px]"
            style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
          >
            One journey.{" "}
            <span className="editorial-italic text-ink-2">Three</span> moves.
          </h2>
        </motion.div>

        <div className="mt-14 grid grid-cols-1 gap-5 md:mt-20 md:grid-cols-3">
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.7, delay: i * 0.1, ease }}
              className="relative flex flex-col rounded-3xl border border-rule bg-bg-card p-7 md:p-8"
            >
              <div className="flex items-center justify-between">
                <span className="grid size-11 place-items-center rounded-full border border-rule bg-bg text-ink">
                  <s.icon className="size-5" strokeWidth={1.6} />
                </span>
                <span
                  className="text-[13px] tracking-[-0.02em] text-ink-4"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {s.n}
                </span>
              </div>
              <h3
                className="mt-6 text-[20px] tracking-[-0.025em] text-ink md:text-[22px]"
                style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
              >
                {s.title}
              </h3>
              <p className="mt-3 text-[14px] leading-relaxed text-ink-2">
                {s.body}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
