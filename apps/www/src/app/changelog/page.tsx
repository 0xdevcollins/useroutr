import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Rss } from "lucide-react";
import { PageShell } from "@/components/site/PageShell";
import { PageEnter } from "@/components/site/PageEnter";
import { PageMast } from "@/components/v2/PageMast";

export const metadata: Metadata = {
  title: "Changelog — Useroutr",
  description:
    "What we've shipped on the Useroutr platform. New features, fixes, and breaking changes, in reverse chronological order.",
  alternates: { canonical: "/changelog" },
};

type EntryTag = "feature" | "fix" | "breaking" | "infra";

interface Entry {
  version: string;
  date: string;
  title: string;
  tags: EntryTag[];
  body: string;
  bullets?: string[];
}

const entries: Entry[] = [
  {
    version: "v1.18",
    date: "May 14, 2026",
    title: "Multi-currency settlement reports",
    tags: ["feature"],
    body: "Settlement reports can now be downloaded with FX-rate snapshots and side-by-side native + reporting currency for every line. Useful for finance teams that close in USD but settle in EURC, XLM, or GBPC.",
    bullets: [
      "CSV and JSON exports gain `reporting_currency` and `fx_rate_at_settlement` fields.",
      "New dashboard filter: native vs. reporting view.",
      "Backfill available on request for settlements since Jan 2026.",
    ],
  },
  {
    version: "v1.17",
    date: "May 2, 2026",
    title: "Webhook signing v2 (HMAC-SHA256)",
    tags: ["feature", "breaking"],
    body: "Webhook signatures move to HMAC-SHA256 with timestamp inclusion. The previous v1 signature header is deprecated and will be removed on August 1, 2026.",
    bullets: [
      "New header: `Useroutr-Signature: t=<ts>,v2=<sig>`.",
      "Updated verification examples in Node, Python, and Go.",
      "Old `Useroutr-Signature-v1` still sent in parallel until cutover.",
    ],
  },
  {
    version: "v1.16",
    date: "April 21, 2026",
    title: "Pay-by-Link templates",
    tags: ["feature"],
    body: "Save common payment-link configurations as templates — perfect for recurring invoices, deposit collection, or product purchases that share the same currency mix and expiry.",
  },
  {
    version: "v1.15",
    date: "April 9, 2026",
    title: "Visa Direct payouts now GA",
    tags: ["feature"],
    body: "Push payouts to any Visa or Mastercard debit card in 80 countries. Funds typically arrive in under 30 minutes. Available in the dashboard and via the `/v1/payouts` endpoint.",
  },
  {
    version: "v1.14",
    date: "March 27, 2026",
    title: "Faster cold-start on hosted checkout",
    tags: ["infra"],
    body: "Hosted checkout pages now ship a smaller JS bundle and resolve the merchant&rsquo;s preferred payment methods server-side. First Contentful Paint is down ~38% on slow connections.",
  },
  {
    version: "v1.13",
    date: "March 11, 2026",
    title: "Idempotency keys are now required for write operations",
    tags: ["breaking"],
    body: "POST/PUT/DELETE requests must include an `Idempotency-Key` header. Requests without one will be rejected with a 400. This change makes retries safe by default and prevents the duplicate-payment class of bugs we keep seeing in customer integrations.",
    bullets: [
      "Grace period until June 1, 2026 — requests without keys return 200 with a deprecation header.",
      "All official SDKs (v1.13+) generate keys automatically.",
      "Recommended: persist your key on the request side until you see a terminal status.",
    ],
  },
  {
    version: "v1.12",
    date: "February 28, 2026",
    title: "EURC support on Stellar",
    tags: ["feature"],
    body: "Accept and settle in EURC across Stellar. Add to the `accept` array on any payment, or set as the default settlement currency in your dashboard.",
  },
  {
    version: "v1.11",
    date: "February 14, 2026",
    title: "Fix: webhook retry storm after partner outage",
    tags: ["fix"],
    body: "A bug in our webhook retry scheduler caused a brief storm of duplicate deliveries for ~6 minutes during a partner outage on Feb 12. Root cause and full postmortem published on the status page.",
  },
];

const tagStyles: Record<EntryTag, string> = {
  feature: "bg-[#e6f4ec] text-[#1f6c43]",
  fix: "bg-[#fbeadc] text-[#a05418]",
  breaking: "bg-[#f8e2e0] text-[#b13226]",
  infra: "bg-[#e8eafb] text-[#3b3da6]",
};

const tagLabels: Record<EntryTag, string> = {
  feature: "Feature",
  fix: "Fix",
  breaking: "Breaking",
  infra: "Infra",
};

export default function ChangelogPage() {
  return (
    <PageShell>
      <PageEnter>
        <PageMast
          eyebrow="Changelog"
          title={
            <>
              What we&rsquo;ve{" "}
              <span className="editorial-italic text-ink-2">shipped</span>.
            </>
          }
          description="New features, bug fixes, and breaking changes on the Useroutr platform — in reverse chronological order."
        >
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/changelog/rss"
              className="group inline-flex items-center gap-1.5 rounded-full border border-rule px-3 py-1.5 text-[12px] text-ink-2 transition hover:border-ink hover:text-ink"
            >
              <Rss className="size-3.5" strokeWidth={1.6} />
              <span>RSS feed</span>
            </Link>
            <Link
              href="https://docs.useroutr.com/api"
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center gap-1 text-[13px] text-ink-2 hover:text-ink"
            >
              <span className="link-underline">API reference</span>
              <ArrowUpRight
                className="size-3.5 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                strokeWidth={1.6}
              />
            </Link>
          </div>
        </PageMast>

        <section className="border-t border-rule py-16 md:py-20">
          <div className="container-x">
            <div className="mx-auto max-w-[860px]">
              <ol className="relative space-y-12 md:space-y-16">
                {entries.map((e) => (
                  <li
                    key={e.version}
                    className="grid grid-cols-1 gap-6 md:grid-cols-[160px_1fr] md:gap-12"
                  >
                    {/* Left meta column */}
                    <div className="md:pt-1">
                      <div
                        className="text-[12px] uppercase tracking-[0.14em] text-ink-3"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {e.date}
                      </div>
                      <div
                        className="mt-1 text-[14px] text-ink"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {e.version}
                      </div>
                    </div>

                    {/* Body */}
                    <div>
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        {e.tags.map((t) => (
                          <span
                            key={t}
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10.5px] uppercase tracking-[0.14em] ${tagStyles[t]}`}
                            style={{ fontFamily: "var(--font-mono)" }}
                          >
                            {tagLabels[t]}
                          </span>
                        ))}
                      </div>
                      <h3
                        className="text-[22px] leading-[1.18] tracking-[-0.02em] text-ink md:text-[26px]"
                        style={{
                          fontFamily: "var(--font-display)",
                          fontWeight: 600,
                        }}
                      >
                        {e.title}
                      </h3>
                      <p className="mt-3 text-[15px] leading-relaxed text-ink-2 md:text-[16px]">
                        {e.body}
                      </p>
                      {e.bullets && (
                        <ul className="mt-4 list-disc space-y-1.5 pl-5 text-[14px] leading-relaxed text-ink-2 marker:text-ink-4">
                          {e.bullets.map((b, i) => (
                            <li key={i}>{b}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </li>
                ))}
              </ol>

              <div className="mt-16 border-t border-rule pt-8 text-center">
                <span
                  className="text-[12px] uppercase tracking-[0.14em] text-ink-3"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  Older entries archived in the{" "}
                  <Link
                    href="https://github.com/useroutr/changelog"
                    target="_blank"
                    rel="noreferrer"
                    className="text-ink-2 underline decoration-rule-2 decoration-from-font underline-offset-4 hover:text-ink"
                  >
                    GitHub log
                  </Link>
                </span>
              </div>
            </div>
          </div>
        </section>
      </PageEnter>
    </PageShell>
  );
}
