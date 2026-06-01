import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageShell } from "@/components/site/PageShell";
import { PageEnter } from "@/components/site/PageEnter";

const stories = {
  "helix-labs": {
    company: "Helix Labs",
    metric: "$2.4M annual fees saved",
    summary:
      "Helix Labs consolidated card, crypto, and payout processing into one reconciliation model.",
    body: [
      "Before Useroutr, Helix Labs reconciled four vendors and two internal ledgers. Finance spent days stitching payout outcomes and FX spread into one close package.",
      "After migrating checkout and disbursements to Useroutr, Helix moved to one transaction timeline and one settlement export. Engineering removed custom retry logic from three services.",
      "The measured outcome was lower payment ops cost and faster month-end close, with annualized vendor-fee savings of approximately $2.4M.",
    ],
  },
  brushwood: {
    company: "Brushwood",
    metric: "97% lower payout costs",
    summary:
      "Brushwood replaced expensive wires with stablecoin-funded global payout rails.",
    body: [
      "Brushwood pays creators across Africa and Southeast Asia. Wire fees and failure retries were eroding margin on every payout cycle.",
      "Using Useroutr bulk payouts, Brushwood moved high-volume corridors to lower-cost rails and gained per-recipient retry controls.",
      "Fee savings reached 97% on key corridors while maintaining predictable payout reliability.",
    ],
  },
  pelago: {
    company: "Pelago Markets",
    metric: "DSO dropped to 14 days",
    summary:
      "Pelago shortened cash conversion cycles by moving invoice collection to on-chain settlement.",
    body: [
      "Pelago relied on SWIFT-heavy receivables for international customers, creating long settlement delays and limited payment visibility.",
      "With Useroutr invoice checkout, customers paid through stablecoin rails while treasury settled into preferred accounts and currencies.",
      "The result was a DSO improvement from 41 days to 14 days and materially better forecasting confidence.",
    ],
  },
} as const;

type StorySlug = keyof typeof stories;

export function generateStaticParams() {
  return Object.keys(stories).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const story = stories[slug as StorySlug];
  if (!story) return { title: "Customer Story — Useroutr" };

  return {
    title: `${story.company} — Customer Story — Useroutr`,
    description: story.summary,
    alternates: { canonical: `/customers/${slug}` },
  };
}

export default async function CustomerStoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const story = stories[slug as StorySlug];
  if (!story) {
    notFound();
  }

  return (
    <PageShell>
      <PageEnter>
        <article className="border-t border-rule py-14 md:py-20">
          <div className="container-x">
            <div className="mx-auto max-w-[760px]">
              <Link
                href="/customers"
                className="group inline-flex items-center gap-1.5 text-[13px] text-ink-2 transition-colors hover:text-ink"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                <ArrowLeft className="size-3.5 transition group-hover:-translate-x-0.5" />
                Back to customers
              </Link>

              <h1
                className="mt-6 text-[42px] leading-[1.02] tracking-[-0.04em] text-ink md:text-[64px]"
                style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
              >
                {story.company}
              </h1>

              <p className="mt-4 text-[18px] leading-relaxed text-ink-2">{story.summary}</p>

              <div className="mt-6 rounded-2xl border border-rule bg-bg-card px-5 py-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-ink-3" style={{ fontFamily: "var(--font-mono)" }}>
                  Key outcome
                </div>
                <div className="mt-2 text-[24px] text-ink" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
                  {story.metric}
                </div>
              </div>

              <div className="mt-10 space-y-6 text-[16px] leading-relaxed text-ink-2 md:text-[18px]">
                {story.body.map((paragraph) => (
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
