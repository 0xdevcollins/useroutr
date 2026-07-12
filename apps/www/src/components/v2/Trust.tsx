"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowLeftRight,
  FileCode2,
  ScanSearch,
  Landmark,
  Receipt,
} from "lucide-react";

const ease = [0.22, 1, 0.36, 1] as const;

const items = [
  {
    icon: ArrowLeftRight,
    title: "Settle or refund — no third state",
    body: "Funds sit in an escrow contract that can only pay the merchant or refund the payer. Refunds after timeout are permissionless: you never depend on us to get money back.",
  },
  {
    icon: FileCode2,
    title: "Open source where it counts",
    body: "Settlement contracts are Apache-2.0, public from the first commit, and independently audited before caps lift.",
  },
  {
    icon: ScanSearch,
    title: "Screened, always",
    body: "Every payout destination is screened against global sanctions lists before execution.",
  },
  {
    icon: Landmark,
    title: "Regulated partners on the fiat leg",
    body: "Local delivery runs through licensed anchor partners — never through gray rails.",
  },
  {
    icon: Receipt,
    title: "Pricing you can read",
    body: "Every quote shows our all-in rate next to the live mid-market rate.",
    href: "/pricing",
    hrefLabel: "See pricing",
  },
];

export function Trust() {
  return (
    <section className="border-b border-rule py-20 md:py-28">
      <div className="container-x">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease }}
          className="max-w-[720px]"
        >
          <span className="eyebrow">Trust</span>
          <h2
            className="mt-4 text-[34px] leading-[1.04] tracking-[-0.035em] text-ink md:text-[52px]"
            style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
          >
            Built like it&rsquo;s{" "}
            <span className="editorial-italic text-accent">your</span> money.
          </h2>
        </motion.div>

        <div className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-3xl border border-rule bg-rule md:mt-16 md:grid-cols-2">
          {items.map((it, i) => (
            <motion.div
              key={it.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, delay: (i % 2) * 0.08, ease }}
              className={`flex gap-4 bg-bg-card p-7 md:p-8 ${
                i === items.length - 1 ? "md:col-span-2" : ""
              }`}
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full border border-rule bg-bg text-ink-2">
                <it.icon className="size-[18px]" strokeWidth={1.6} />
              </span>
              <div>
                <h3 className="text-[16px] font-medium tracking-[-0.01em] text-ink">
                  {it.title}
                </h3>
                <p className="mt-2 max-w-[520px] text-[14px] leading-relaxed text-ink-2">
                  {it.body}
                  {it.href && (
                    <>
                      {" "}
                      <Link
                        href={it.href}
                        className="text-accent-ink underline decoration-accent/30 underline-offset-4 transition hover:decoration-accent"
                      >
                        {it.hrefLabel}
                      </Link>
                    </>
                  )}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
