"use client";

import { motion } from "motion/react";

const ease = [0.22, 1, 0.36, 1] as const;

type Quote = {
  body: string;
  emphasis: string; // word(s) to emphasize in italic at the end
  initials: string;
  name: string;
  role: string;
  company: string;
  tone: string;
};

const quotes: Quote[] = [
  {
    body: "We replaced four vendors with Useroutr. Cards, USDC, off-ramp, and bank payouts now share one ledger.",
    emphasis: "one ledger",
    initials: "MO",
    name: "Maya Okonkwo",
    role: "Head of Treasury",
    company: "Helix Labs",
    tone: "bg-[#e8eafb] text-ink",
  },
  {
    body: "We were paying $25 per wire to send contractors in Nigeria. With Useroutr it's basically free and lands in seconds.",
    emphasis: "in seconds",
    initials: "DK",
    name: "David Kim",
    role: "Ops Lead",
    company: "Brushwood",
    tone: "bg-[#fbeadc] text-ink",
  },
];

export function Testimonials() {
  return (
    <section className="relative border-t border-rule pt-20 pb-20 md:pt-28 md:pb-28">
      <div className="container-x">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease }}
          className="mx-auto max-w-[760px] text-center"
        >
          <h2
            className="text-[34px] leading-[1.04] tracking-[-0.035em] text-ink md:text-[52px]"
            style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
          >
            What teams in the{" "}
            <span className="editorial-italic text-ink-2">private beta</span>{" "}
            are saying.
          </h2>
        </motion.div>

        <div className="mx-auto mt-14 grid max-w-[1100px] grid-cols-1 gap-5 md:mt-20 md:grid-cols-2">
          {quotes.map((q, i) => (
            <motion.figure
              key={q.name}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.75, delay: i * 0.1, ease }}
              className="flex h-full flex-col rounded-3xl border border-rule bg-bg-card p-8 shadow-[0_30px_80px_-50px_rgba(14,14,12,0.18)] md:p-10"
            >
              <span
                aria-hidden
                className="text-[60px] leading-none text-ink-4"
                style={{ fontFamily: "var(--font-fraunces)", fontStyle: "italic" }}
              >
                &ldquo;
              </span>
              <blockquote className="-mt-6 text-[20px] leading-[1.4] tracking-[-0.012em] text-ink md:text-[24px]">
                {renderBodyWithEmphasis(q.body, q.emphasis)}
              </blockquote>

              <figcaption className="mt-auto flex items-center gap-3 pt-8">
                <span
                  className={`grid size-11 shrink-0 place-items-center rounded-full text-[13px] font-medium ${q.tone}`}
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {q.initials}
                </span>
                <span className="flex-1">
                  <span className="block text-[14px] font-medium text-ink">
                    {q.name}
                  </span>
                  <span
                    className="block text-[11.5px] uppercase tracking-[0.12em] text-ink-3"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {q.role} · {q.company}
                  </span>
                </span>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Renders the quote body and replaces the final occurrence of `emphasis`
 * with a Fraunces italic span — same editorial treatment as the headlines.
 */
function renderBodyWithEmphasis(body: string, emphasis: string): React.ReactNode {
  const idx = body.lastIndexOf(emphasis);
  if (idx < 0) return body;
  return (
    <>
      {body.slice(0, idx)}
      <span className="editorial-italic text-ink-2">{emphasis}</span>
      {body.slice(idx + emphasis.length)}
    </>
  );
}
