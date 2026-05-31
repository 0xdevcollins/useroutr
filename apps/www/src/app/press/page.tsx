import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Download } from "lucide-react";
import { PageShell } from "@/components/site/PageShell";
import { PageEnter } from "@/components/site/PageEnter";
import { PageMast } from "@/components/v2/PageMast";

export const metadata: Metadata = {
  title: "Press — Useroutr",
  description:
    "Press releases, media coverage, and brand assets for Useroutr Labs, Inc.",
  alternates: { canonical: "/press" },
};

const releases = [
  {
    date: "April 18, 2026",
    label: "Funding",
    title:
      "Useroutr raises $24M Series A to build cross-chain stablecoin payment infrastructure",
    excerpt:
      "Round led by Bessemer Venture Partners with participation from Stellar Development Foundation, Coinbase Ventures, and Multicoin Capital.",
    href: "/press/series-a",
  },
  {
    date: "February 4, 2026",
    label: "Product",
    title:
      "Useroutr launches Pay-by-Link, bringing one-tap stablecoin payments to invoices",
    excerpt:
      "Hosted checkout URLs accept USDC, EURC, or fiat — merchants get paid in their currency of choice without writing a line of code.",
    href: "/press/pay-by-link",
  },
  {
    date: "November 12, 2025",
    label: "Partnership",
    title:
      "Useroutr partners with MoneyGram for cash-pickup payouts in 174 countries",
    excerpt:
      "Businesses on Useroutr can now send USDC-funded payouts that land as cash at any MoneyGram location worldwide.",
    href: "/press/moneygram-partnership",
  },
  {
    date: "August 30, 2025",
    label: "Launch",
    title: "Useroutr exits stealth with private beta of its payment API",
    excerpt:
      "Built on Stellar and Soroban, Useroutr offers stablecoin payment processing with a Stripe-style developer experience.",
    href: "/press/exit-stealth",
  },
];

const mentions = [
  {
    publication: "TechCrunch",
    title: "Useroutr wants to be the Stripe of stablecoin payments",
    date: "April 19, 2026",
    href: "#",
  },
  {
    publication: "The Block",
    title: "How Useroutr is rebuilding cross-border payouts on Stellar",
    date: "March 2, 2026",
    href: "#",
  },
  {
    publication: "Sifted",
    title: "Stablecoin payments are having a moment — Useroutr leads the charge",
    date: "February 11, 2026",
    href: "#",
  },
  {
    publication: "Fortune",
    title: "Stablecoin payments find product-market fit with B2B treasury teams",
    date: "January 28, 2026",
    href: "#",
  },
];

const brandAssets = [
  {
    label: "Logo · SVG",
    sub: "Wordmark + monogram, light and dark",
    href: "/brand/useroutr-logo.zip",
  },
  {
    label: "Brand guidelines",
    sub: "Colors, type, voice (PDF, 1.4 MB)",
    href: "/brand/useroutr-brand.pdf",
  },
  {
    label: "Founder photos",
    sub: "High-res, attribution-included",
    href: "/brand/useroutr-team.zip",
  },
];

export default function PressPage() {
  return (
    <PageShell>
      <PageEnter>
        <PageMast
          eyebrow="Press"
          title={
            <>
              In the{" "}
              <span className="editorial-italic text-ink-2">news</span>.
            </>
          }
          description="Press releases, coverage, and brand assets. For interview or comment requests, email press@useroutr.com."
        />

        {/* Press contact strip */}
        <section className="border-y border-rule bg-bg-soft/40 py-6">
          <div className="container-x flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px]">
              <span
                className="text-[11px] uppercase tracking-[0.14em] text-ink-3"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                Press contact
              </span>
              <a
                href="mailto:press@useroutr.com"
                className="text-ink underline decoration-rule-2 decoration-from-font underline-offset-4 hover:text-ink"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                press@useroutr.com
              </a>
              <span
                className="text-ink-3"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                +1 (415) 555-0142
              </span>
            </div>
            <Link
              href="/brand/useroutr-press-kit.zip"
              className="group inline-flex items-center gap-1.5 text-[13px] text-ink-2 hover:text-ink"
            >
              <Download className="size-3.5" strokeWidth={1.6} />
              <span className="link-underline">Download press kit</span>
            </Link>
          </div>
        </section>

        {/* Releases */}
        <section className="border-b border-rule py-20 md:py-24">
          <div className="container-x">
            <div className="mx-auto max-w-[1080px]">
              <h2
                className="text-[26px] leading-[1.1] tracking-[-0.025em] text-ink md:text-[36px]"
                style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
              >
                Releases
              </h2>

              <ul className="mt-10 divide-y divide-rule border-y border-rule">
                {releases.map((r) => (
                  <li key={r.href}>
                    <Link
                      href={r.href}
                      className="group grid grid-cols-1 gap-3 py-6 transition-colors md:grid-cols-[140px_100px_1fr_24px] md:items-baseline md:gap-6 md:py-8"
                    >
                      <span
                        className="text-[12px] uppercase tracking-[0.14em] text-ink-3"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {r.date}
                      </span>
                      <span
                        className="inline-flex w-fit items-center rounded-full border border-rule px-2.5 py-0.5 text-[11px] uppercase tracking-[0.14em] text-ink-2"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {r.label}
                      </span>
                      <div>
                        <div
                          className="text-[19px] leading-[1.25] tracking-[-0.02em] text-ink transition-colors group-hover:text-ink md:text-[22px]"
                          style={{
                            fontFamily: "var(--font-display)",
                            fontWeight: 600,
                          }}
                        >
                          {r.title}
                        </div>
                        <p className="mt-2 max-w-[560px] text-[14px] leading-relaxed text-ink-2">
                          {r.excerpt}
                        </p>
                      </div>
                      <span className="hidden md:block">
                        <ArrowUpRight
                          className="size-4 text-ink-3 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink"
                          strokeWidth={1.6}
                        />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Coverage */}
        <section className="border-b border-rule py-20 md:py-24">
          <div className="container-x">
            <div className="mx-auto max-w-[1080px]">
              <h2
                className="text-[26px] leading-[1.1] tracking-[-0.025em] text-ink md:text-[36px]"
                style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
              >
                Coverage
              </h2>

              <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
                {mentions.map((m) => (
                  <a
                    key={m.title}
                    href={m.href}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex flex-col gap-3 rounded-2xl border border-rule bg-bg-card p-6 transition-colors hover:border-rule-2"
                  >
                    <div className="flex items-baseline justify-between">
                      <span
                        className="text-[12px] uppercase tracking-[0.14em] text-ink-3"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {m.publication}
                      </span>
                      <span
                        className="text-[11px] text-ink-3"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {m.date}
                      </span>
                    </div>
                    <p
                      className="text-[16px] leading-[1.3] tracking-[-0.015em] text-ink md:text-[18px]"
                      style={{
                        fontFamily: "var(--font-display)",
                        fontWeight: 500,
                      }}
                    >
                      &ldquo;{m.title}&rdquo;
                    </p>
                    <span className="mt-auto inline-flex items-center gap-1 text-[13px] text-ink-3 transition group-hover:text-ink">
                      <span className="link-underline">Read</span>
                      <ArrowUpRight
                        className="size-3.5 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                        strokeWidth={1.6}
                      />
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Brand assets */}
        <section className="py-20 md:py-24">
          <div className="container-x">
            <div className="mx-auto max-w-[1080px]">
              <h2
                className="text-[26px] leading-[1.1] tracking-[-0.025em] text-ink md:text-[36px]"
                style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
              >
                Brand assets
              </h2>
              <p className="mt-3 max-w-[520px] text-[15px] text-ink-2">
                Logos, brand guidelines, and high-res photography. Please
                don&rsquo;t alter the wordmark, and always use it on a
                sufficient-contrast background.
              </p>

              <div className="mt-10 grid grid-cols-1 gap-3 md:grid-cols-3">
                {brandAssets.map((a) => (
                  <Link
                    key={a.href}
                    href={a.href}
                    className="group flex items-start gap-3 rounded-2xl border border-rule bg-bg-card p-5 transition hover:border-rule-2"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-bg-soft text-ink-2 transition group-hover:bg-ink group-hover:text-bg">
                      <Download className="size-4" strokeWidth={1.6} />
                    </span>
                    <span className="flex-1">
                      <span className="block text-[14px] font-medium text-ink">
                        {a.label}
                      </span>
                      <span className="block text-[12.5px] text-ink-3">
                        {a.sub}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      </PageEnter>
    </PageShell>
  );
}
