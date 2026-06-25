"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandLogo } from "./BrandLogo";
import { BRAND_LOGOS } from "@/lib/brand-logos";

const ease = [0.22, 1, 0.36, 1] as const;

type Lang = "node" | "python" | "curl" | "go";

const snippets: Record<Lang, string[]> = {
  node: [
    "import { Useroutr } from '@useroutr/sdk';",
    "",
    "const useroutr = new Useroutr(process.env.USEROUTR_KEY);",
    "",
    "const payment = await useroutr.payments.create({",
    "  amount:   49_00,           // $49.00",
    "  currency: 'USD',",
    "  accept:   ['usdc', 'card', 'ach'],",
    "  settle:   { rail: 'stellar', address: 'GA...' },",
    "});",
    "",
    "return payment.checkout_url;",
  ],
  python: [
    "from useroutr import Useroutr",
    "",
    "useroutr = Useroutr(api_key=os.environ['USEROUTR_KEY'])",
    "",
    "payment = useroutr.payments.create(",
    "    amount=4900,           # $49.00",
    "    currency='USD',",
    "    accept=['usdc', 'card', 'ach'],",
    "    settle={'rail': 'stellar', 'address': 'GA...'},",
    ")",
    "",
    "return payment.checkout_url",
  ],
  curl: [
    "curl https://api.useroutr.com/v1/payments \\",
    '  -H "Authorization: Bearer $USEROUTR_KEY" \\',
    "  -d amount=4900 \\",
    "  -d currency=USD \\",
    "  -d 'accept[]=usdc' \\",
    "  -d 'accept[]=card' \\",
    "  -d 'accept[]=ach' \\",
    "  -d 'settle[rail]=stellar' \\",
    "  -d 'settle[address]=GA...'",
  ],
  go: [
    'import "github.com/useroutr/useroutr-go"',
    "",
    'client := useroutr.NewClient(os.Getenv("USEROUTR_KEY"))',
    "",
    "payment, err := client.Payments.Create(ctx, &useroutr.PaymentInput{",
    "    Amount:   4900,",
    '    Currency: "USD",',
    '    Accept:   []string{"usdc", "card", "ach"},',
    '    Settle:   &useroutr.Settle{Rail: "stellar", Address: "GA..."},',
    "})",
  ],
};

const integrations = [
  "stripe",
  "quickbooks",
  "xero",
  "netsuite",
  "zapier",
  "slack",
  "notion",
  "webhooks",
];

export function Developers() {
  const [lang, setLang] = useState<Lang>("node");

  return (
    <section
      id="developers"
      className="relative border-t border-rule pt-20 pb-20 md:pt-28 md:pb-28"
    >
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
            Built for{" "}
            <span className="editorial-italic text-accent">engineers</span>, not
            architects.
          </h2>
          <p className="mx-auto mt-5 max-w-[520px] text-[16px] leading-relaxed text-ink-2">
            One API to accept, route, and settle. Typed SDKs for the languages
            your team already writes in. Webhooks, idempotency, and request logs
            out of the box.
          </p>
        </motion.div>

        <div className="mt-14 grid grid-cols-1 gap-5 md:mt-20 md:grid-cols-2">
          {/* Code card — dark */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.8, ease }}
            className="overflow-hidden rounded-3xl border border-rule-2/20 bg-bg-deep text-bg shadow-[0_40px_100px_-40px_rgba(0,0,0,0.5)]"
          >
            {/* Tab bar */}
            <div className="flex items-center justify-between border-b border-bg/10 px-4 py-3">
              <div className="flex items-center gap-1">
                {(["node", "python", "curl", "go"] as Lang[]).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLang(l)}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] transition-colors",
                      l === lang
                        ? "bg-bg/15 text-bg"
                        : "text-bg/50 hover:text-bg/80",
                    )}
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {l === "node" ? "ts" : l}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="hidden text-[11px] text-bg/50 sm:inline"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  POST /v1/payments
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
              <AnimatePresence mode="wait">
                <motion.pre
                  key={lang}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.22, ease }}
                  className="m-0 p-6 text-[12.5px] leading-[1.65] md:text-[13px]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {snippets[lang].map((line, i) => (
                    <CodeLine key={i} num={i + 1} text={line} />
                  ))}
                </motion.pre>
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 border-t border-bg/10 px-5 py-4">
              <div>
                <div className="text-[13px] font-medium text-bg">
                  Charge in 4 lines.
                </div>
                <div className="text-[11.5px] text-bg/60">
                  Same SDK across every supported chain and rail.
                </div>
              </div>
              <Link
                href="https://docs.useroutr.com"
                target="_blank"
                rel="noreferrer"
                className="group inline-flex shrink-0 items-center gap-1.5 rounded-full bg-bg/10 px-3 py-2 text-[12px] text-bg transition hover:bg-bg/20"
              >
                Read the docs
                <ArrowUpRight
                  className="size-3.5 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  strokeWidth={1.6}
                />
              </Link>
            </div>
          </motion.div>

          {/* Integrations — light */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.8, delay: 0.1, ease }}
            className="overflow-hidden rounded-3xl border border-rule bg-bg-card p-6 shadow-[0_40px_100px_-40px_rgba(14,14,12,0.28)] md:p-8"
          >
            <div className="flex items-center justify-between">
              <span
                className="text-[11px] uppercase tracking-[0.14em] text-ink-3"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                Integrations
              </span>
              <span
                className="text-[11px] text-ink-3"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                40+ pre-built · custom via webhooks
              </span>
            </div>

            <h3
              className="mt-5 text-[22px] leading-[1.15] tracking-[-0.025em] text-ink md:text-[26px]"
              style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
            >
              Plugs into the tools your team{" "}
              <span className="editorial-italic text-ink-2">already</span> runs.
            </h3>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-3">
              Sync to your accounting, fire alerts in Slack, automate workflows.
              We send a webhook for every state change.
            </p>

            <div className="mt-6 grid grid-cols-4 gap-2">
              {integrations.map((id) => (
                <div
                  key={id}
                  className="group flex flex-col items-center gap-2 rounded-2xl border border-rule bg-bg-card p-3 transition hover:border-rule-2"
                >
                  <BrandLogo id={id} size="md" shape="square" />
                  <span
                    className="text-[10px] uppercase tracking-[0.12em] text-ink-3"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {BRAND_LOGOS[id]?.label ?? id}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-6 border-t border-rule pt-5">
              <Link
                href="/integrations"
                className="group inline-flex items-center gap-1 text-[14px] text-ink-2 transition-colors hover:text-ink"
              >
                <span className="link-underline">See all integrations</span>
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
 * Very lightweight tokenizer — colorizes strings, comments, keywords,
 * and numbers so the code feels alive without pulling in a syntax engine.
 */
function colorize(line: string): React.ReactNode {
  if (line.trim().startsWith("//") || line.trim().startsWith("#")) {
    return <span className="text-bg/40">{line}</span>;
  }
  // Split on string literals
  const parts: React.ReactNode[] = [];
  const re =
    /(['"`][^'"`]*['"`])|(\b(?:import|from|const|let|var|await|new|return|client|os)\b)|(\b\d+(?:_\d+)?\b)/g;
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
