import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { PageShell } from "@/components/site/PageShell";
import { PageEnter } from "@/components/site/PageEnter";
import { PageMast } from "@/components/v2/PageMast";

export const metadata: Metadata = {
  title: "Customers — Useroutr",
  description:
    "Marketplaces, fintechs, and global businesses building on Useroutr's cross-chain stablecoin payment infrastructure.",
  alternates: { canonical: "/customers" },
};

const logos = [
  "Helix Labs",
  "Brushwood",
  "Ardent Capital",
  "Lagosgrid",
  "Northsea Studio",
  "Pelago Markets",
  "Atlas Pay",
  "Quanta",
];

const stories = [
  {
    slug: "helix-labs",
    company: "Helix Labs",
    industry: "B2B marketplace",
    headline: "Replaced four vendors with one ledger.",
    metric: "$2.4M",
    metricLabel: "Annual fees saved",
    body: "Helix Labs was running cards on Stripe, USDC on Circle, off-ramp on a third vendor, and bank payouts on a fourth. Reconciling across four ledgers cost their finance team three days a month.",
    tone: "bg-[#e8eafb]",
    initials: "HL",
  },
  {
    slug: "brushwood",
    company: "Brushwood",
    industry: "Creator marketplace",
    headline: "$25/wire → basically free.",
    metric: "97%",
    metricLabel: "Lower payout costs",
    body: "Brushwood pays 1,200 contractors across Nigeria, Kenya, and the Philippines every month. Wire fees were eating their unit economics. Useroutr's stablecoin payouts landed in seconds at less than a cent of network fee per transaction.",
    tone: "bg-[#fbeadc]",
    initials: "BW",
  },
  {
    slug: "pelago",
    company: "Pelago Markets",
    industry: "Cross-border treasury",
    headline: "Same-day settlement on cross-border AR.",
    metric: "14 days",
    metricLabel: "DSO, down from 41",
    body: "Pelago's customers in Europe and Latin America were paying invoices via SWIFT — 3 to 5 days to land, plus 1.2% in fees. Useroutr's USDC-on-Stellar checkout cut DSO from 41 days to 14 and dropped fee cost by 95%.",
    tone: "bg-[#e3f5e8]",
    initials: "PM",
  },
];

export default function CustomersPage() {
  return (
    <PageShell>
      <PageEnter>
        <PageMast
          eyebrow="Customers"
          title={
            <>
              Built with the teams who feel{" "}
              <span className="editorial-italic text-ink-2">payment pain</span>{" "}
              every day.
            </>
          }
          description="Marketplaces, fintechs, treasury teams, and cross-border businesses use Useroutr to take and settle payments without managing four vendors."
        />

        {/* Customer logos */}
        <section className="border-t border-rule pt-12 pb-16 md:pt-14 md:pb-20">
          <div className="container-x">
            <div className="grid grid-cols-2 gap-y-8 md:grid-cols-4">
              {logos.map((l) => (
                <div key={l} className="flex justify-center">
                  <span
                    className="text-[18px] tracking-[-0.02em] text-ink-3 md:text-[22px]"
                    style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}
                  >
                    {l}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Case studies */}
        <section className="border-t border-rule py-20 md:py-28">
          <div className="container-x">
            <div className="mx-auto max-w-[840px] text-center">
              <h2
                className="text-[34px] leading-[1.04] tracking-[-0.035em] text-ink md:text-[52px]"
                style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
              >
                Case <span className="editorial-italic text-ink-2">studies</span>
                .
              </h2>
            </div>

            <div className="mx-auto mt-14 max-w-[1080px] space-y-5 md:mt-20">
              {stories.map((s) => (
                <Link
                  key={s.slug}
                  href={`/customers/${s.slug}`}
                  className="group flex flex-col gap-6 rounded-3xl border border-rule bg-bg-card p-6 transition-all hover:border-rule-2 md:flex-row md:items-center md:gap-10 md:p-10"
                >
                  {/* Visual mark */}
                  <div className={`flex shrink-0 items-center gap-4 md:w-[260px] ${s.tone} rounded-2xl px-5 py-6`}>
                    <span
                      className="grid size-12 place-items-center rounded-xl bg-ink text-[15px] font-medium text-bg"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {s.initials}
                    </span>
                    <div>
                      <div className="text-[14px] font-medium text-ink">
                        {s.company}
                      </div>
                      <div
                        className="text-[11px] uppercase tracking-[0.14em] text-ink-3"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {s.industry}
                      </div>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="flex-1">
                    <h3
                      className="text-[22px] leading-[1.18] tracking-[-0.025em] text-ink md:text-[28px]"
                      style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
                    >
                      {s.headline}
                    </h3>
                    <p className="mt-3 max-w-[600px] text-[14.5px] leading-relaxed text-ink-2 md:text-[15.5px]">
                      {s.body}
                    </p>
                  </div>

                  {/* Metric */}
                  <div className="shrink-0 md:text-right">
                    <div
                      className="text-[36px] leading-none tracking-[-0.03em] text-ink md:text-[44px]"
                      style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
                    >
                      {s.metric}
                    </div>
                    <div
                      className="mt-1 text-[10.5px] uppercase tracking-[0.14em] text-ink-3"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {s.metricLabel}
                    </div>
                  </div>

                  {/* Arrow */}
                  <span className="hidden shrink-0 md:block">
                    <span className="grid size-10 place-items-center rounded-full border border-rule-2 text-ink-2 transition-all group-hover:translate-x-1 group-hover:border-ink group-hover:text-ink">
                      <ArrowRight className="size-4" strokeWidth={1.6} />
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-rule py-20 md:py-28">
          <div className="container-x">
            <div className="mx-auto max-w-[720px] text-center">
              <h2
                className="text-[28px] leading-[1.1] tracking-[-0.03em] text-ink md:text-[40px]"
                style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
              >
                Want your team in this lineup?
              </h2>
              <p className="mx-auto mt-5 max-w-[480px] text-[15.5px] leading-relaxed text-ink-2 md:text-[17px]">
                We&rsquo;re onboarding a small number of design-partner teams
                each month. We&rsquo;d love to hear what you&rsquo;re building.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <Link
                  href="mailto:hello@useroutr.com?subject=Useroutr%20design%20partner"
                  className="magnet"
                >
                  <span className="pill pill-dark py-3 text-[13px]">
                    Talk to us
                    <ArrowRight className="size-4" strokeWidth={1.6} />
                  </span>
                </Link>
                <Link
                  href="/use-cases"
                  className="group inline-flex items-center gap-1.5 text-[14px] text-ink-2 transition-colors hover:text-ink"
                >
                  <span className="link-underline">See use cases</span>
                  <ArrowUpRight
                    className="size-3.5 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                    strokeWidth={1.6}
                  />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </PageEnter>
    </PageShell>
  );
}
