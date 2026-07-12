"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowUpRight, Check, Copy } from "lucide-react";

const ease = [0.22, 1, 0.36, 1] as const;

const snippet = [
  'import Useroutr from "@useroutr/sdk";',
  "",
  'const useroutr = new Useroutr({ apiKey: "ur_test_…" });',
  "",
  "const payout = await useroutr.payouts.create({",
  '  recipientId: "rcp_01J9X…",',
  "  amount: 1_500_000,            // ₦15,000.00, in kobo",
  '  currency: "NGN",',
  '  sourceAsset: "USDC:stellar",',
  "});",
  "",
  "// webhook → payout.completed: funds are spendable",
];

const promises = [
  "Free test environment on Stellar testnet",
  "Fully indexed — behaves exactly like production",
  "No card required to start",
  "One typed SDK, one API key",
];

export function Developers() {
  return (
    <section
      id="developers"
      className="relative border-b border-rule pt-20 pb-20 md:pt-28 md:pb-28"
    >
      <div className="container-x">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease }}
          className="mx-auto max-w-[760px] text-center"
        >
          <span className="eyebrow">Built for developers</span>
          <h2
            className="mt-4 text-[34px] leading-[1.04] tracking-[-0.035em] text-ink md:text-[52px]"
            style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
          >
            First sandbox payout in{" "}
            <span className="editorial-italic text-accent">under 10</span>{" "}
            minutes.
          </h2>
          <p className="mx-auto mt-5 max-w-[520px] text-[16px] leading-relaxed text-ink-2">
            One API to quote, pay, and reconcile. Typed TypeScript SDK, idempotent
            requests, signed webhooks — and a webhook that fires when money is
            spendable, not when we “initiated” it.
          </p>
        </motion.div>

        <div className="mt-14 grid grid-cols-1 gap-5 md:mt-20 md:grid-cols-5">
          {/* Code card — dark */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.8, ease }}
            className="overflow-hidden rounded-3xl border border-rule-2/20 bg-bg-deep text-bg shadow-[0_40px_100px_-40px_rgba(0,0,0,0.5)] md:col-span-3"
          >
            {/* Tab bar */}
            <div className="flex items-center justify-between border-b border-bg/10 px-4 py-3">
              <span
                className="rounded-full bg-bg/15 px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-bg"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                ts
              </span>
              <div className="flex items-center gap-3">
                <span
                  className="hidden text-[11px] text-bg/50 sm:inline"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  POST /v1/payouts
                </span>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full border border-bg/15 px-2 py-1 text-[10px] text-bg/70 transition hover:border-bg/40 hover:text-bg"
                >
                  <Copy className="size-3" strokeWidth={1.6} />
                  Copy
                </button>
              </div>
            </div>

            {/* Code body */}
            <div className="relative overflow-x-auto">
              <pre
                className="m-0 p-6 text-[12.5px] leading-[1.7] md:text-[13px]"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {snippet.map((line, i) => (
                  <CodeLine key={i} num={i + 1} text={line} />
                ))}
              </pre>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 border-t border-bg/10 px-5 py-4">
              <div>
                <div className="text-[13px] font-medium text-bg">
                  A payout in one call.
                </div>
                <div className="text-[11.5px] text-bg/60">
                  Same SDK for single and bulk disbursement.
                </div>
              </div>
              <Link
                href="https://docs.useroutr.com"
                target="_blank"
                rel="noreferrer"
                className="group inline-flex shrink-0 items-center gap-1.5 rounded-full bg-bg/10 px-3 py-2 text-[12px] text-bg transition hover:bg-bg/20"
              >
                Open the quickstart
                <ArrowUpRight
                  className="size-3.5 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  strokeWidth={1.6}
                />
              </Link>
            </div>
          </motion.div>

          {/* Sandbox promise — light */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.8, delay: 0.1, ease }}
            className="flex flex-col overflow-hidden rounded-3xl border border-rule bg-bg-card p-6 shadow-[0_40px_100px_-40px_rgba(14,14,12,0.28)] md:col-span-2 md:p-8"
          >
            <span
              className="text-[11px] uppercase tracking-[0.14em] text-ink-3"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Sandbox
            </span>
            <h3
              className="mt-5 text-[22px] leading-[1.15] tracking-[-0.025em] text-ink md:text-[26px]"
              style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
            >
              Test everything.{" "}
              <span className="editorial-italic text-ink-2">Free.</span>
            </h3>

            <ul className="mt-6 space-y-3.5">
              {promises.map((p) => (
                <li key={p} className="flex items-start gap-3">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-ink">
                    <Check className="size-3" strokeWidth={2.4} />
                  </span>
                  <span className="text-[14px] leading-relaxed text-ink-2">
                    {p}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-auto border-t border-rule pt-5">
              <Link
                href="https://docs.useroutr.com"
                target="_blank"
                rel="noreferrer"
                className="group inline-flex items-center gap-1 text-[14px] text-ink-2 transition-colors hover:text-ink"
              >
                <span className="link-underline">Read the docs</span>
                <ArrowUpRight
                  className="size-3.5 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  strokeWidth={1.6}
                />
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- */
function CodeLine({ num, text }: { num: number; text: string }) {
  return (
    <div className="flex">
      <span className="mr-4 inline-block w-6 select-none text-right text-bg/30">
        {num}
      </span>
      <span className="text-bg/90">{colorize(text)}</span>
    </div>
  );
}

/**
 * Lightweight tokenizer — colorizes strings, comments, keywords, and numbers
 * so the code feels alive without pulling in a syntax engine.
 */
function colorize(line: string): React.ReactNode {
  if (line.trim().startsWith("//") || line.trim().startsWith("#")) {
    return <span className="text-bg/40">{line}</span>;
  }
  const parts: React.ReactNode[] = [];
  const re =
    /(['"`][^'"`]*['"`])|(\b(?:import|from|const|let|var|await|new|return)\b)|(\b\d+(?:_\d+)?\b)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) parts.push(line.slice(last, m.index));
    if (m[1]) {
      parts.push(
        <span key={i++} className="text-[#c4f0a0]">
          {m[1]}
        </span>,
      );
    } else if (m[2]) {
      parts.push(
        <span key={i++} className="text-[#b3a4ff]">
          {m[2]}
        </span>,
      );
    } else if (m[3]) {
      parts.push(
        <span key={i++} className="text-[#ffd28a]">
          {m[3]}
        </span>,
      );
    }
    last = re.lastIndex;
  }
  if (last < line.length) parts.push(line.slice(last));
  return <>{parts}</>;
}
