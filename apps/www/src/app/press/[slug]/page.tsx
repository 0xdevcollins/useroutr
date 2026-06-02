import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageShell } from "@/components/site/PageShell";
import { PageEnter } from "@/components/site/PageEnter";

const releases = {
  "series-a": {
    title: "Useroutr raises $24M Series A to scale cross-chain payments",
    date: "April 18, 2026",
    body: [
      "Useroutr announced a $24M Series A led by Bessemer Venture Partners with participation from Stellar Development Foundation, Coinbase Ventures, and Multicoin Capital.",
      "The funding supports expansion of payment and payout coverage, deeper compliance automation, and enterprise procurement readiness.",
      "Useroutr plans to grow engineering, compliance, and customer success teams in 2026 while expanding support for treasury and ERP integrations.",
    ],
  },
  "pay-by-link": {
    title: "Useroutr launches Pay-by-Link for no-code payment collection",
    date: "February 4, 2026",
    body: [
      "Useroutr introduced Pay-by-Link to help teams collect payments through branded hosted links with no frontend build required.",
      "The launch includes single-use and reusable links, open-amount collection, expiration controls, and analytics for conversion and completion.",
      "Payments collected by link flow into the same reconciliation model as API-driven payments and invoices.",
    ],
  },
  "moneygram-partnership": {
    title: "Useroutr partners with MoneyGram for global cash pickup payouts",
    date: "November 12, 2025",
    body: [
      "Useroutr announced a partnership that enables businesses to route eligible payout flows to MoneyGram cash pickup destinations.",
      "The integration extends payout coverage in corridors where recipients prefer local cash access over bank transfers.",
      "Customers can choose destination rail per recipient while keeping one payout API contract.",
    ],
  },
  "exit-stealth": {
    title: "Useroutr exits stealth with private beta access",
    date: "August 30, 2025",
    body: [
      "Useroutr emerged from stealth and opened private beta access for selected fintech and marketplace teams.",
      "The beta introduced payments, payment links, invoices, and payouts with typed webhooks and hosted checkout.",
      "Early design partners focused on cross-border receivables and treasury disbursement workflows.",
    ],
  },
} as const;

type ReleaseSlug = keyof typeof releases;

export function generateStaticParams() {
  return Object.keys(releases).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const release = releases[slug as ReleaseSlug];
  if (!release) return { title: "Press — Useroutr" };

  return {
    title: `${release.title} — Useroutr`,
    description: release.body[0],
    alternates: { canonical: `/press/${slug}` },
  };
}

export default async function PressReleasePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const release = releases[slug as ReleaseSlug];
  if (!release) {
    notFound();
  }

  return (
    <PageShell>
      <PageEnter>
        <article className="border-t border-rule py-14 md:py-20">
          <div className="container-x">
            <div className="mx-auto max-w-[760px]">
              <Link
                href="/press"
                className="group inline-flex items-center gap-1.5 text-[13px] text-ink-2 transition-colors hover:text-ink"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                <ArrowLeft className="size-3.5 transition group-hover:-translate-x-0.5" />
                Back to press
              </Link>

              <div className="mt-6 text-[11px] uppercase tracking-[0.14em] text-ink-3" style={{ fontFamily: "var(--font-mono)" }}>
                {release.date}
              </div>

              <h1
                className="mt-4 text-[38px] leading-[1.03] tracking-[-0.04em] text-ink md:text-[58px]"
                style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
              >
                {release.title}
              </h1>

              <div className="mt-10 space-y-6 text-[16px] leading-relaxed text-ink-2 md:text-[18px]">
                {release.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </div>
          </div>
        </article>
      </PageEnter>
    </PageShell>
  );
}
