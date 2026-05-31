import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PageShell } from "@/components/site/PageShell";
import { PageEnter } from "@/components/site/PageEnter";
import { PageMast } from "@/components/v2/PageMast";

export const metadata: Metadata = {
  title: "About — Useroutr",
  description:
    "Useroutr is building cross-chain stablecoin payment infrastructure. Our story, our team, and what we believe.",
  alternates: { canonical: "/about" },
};

const principles = [
  {
    title: "Managed by default, self-custody by choice",
    body: "Settlement happens on-chain. We provision a managed Stellar wallet for every merchant at signup so they can take payments from day one, with an upgrade path to passkey or bring-your-own self-custody whenever they're ready. The funds never sit on our balance sheet.",
  },
  {
    title: "Stripe-level developer experience",
    body: "Typed SDKs, sensible defaults, real error messages, and docs that read like a tutorial. Integration time is a product feature.",
  },
  {
    title: "Boring infrastructure, exciting outcomes",
    body: "Payments should be invisible. We obsess over the boring parts — reconciliation, retries, idempotency, edge cases — so your team can focus on the business.",
  },
  {
    title: "Honest pricing",
    body: "One transparent rate. Network fees passed through at cost. No setup, no minimums, no surprises in the contract.",
  },
];

const team = [
  {
    name: "Mira Adeoye",
    role: "Co-founder, CEO",
    bio: "Previously led international payouts at Plaid. Built the first ACH-to-stablecoin bridge for a top-5 fintech.",
    initials: "MA",
    tone: "bg-[#e8eafb] text-ink",
  },
  {
    name: "Lukas Vogel",
    role: "Co-founder, CTO",
    bio: "Former staff engineer at Stripe Treasury. Wrote the original double-entry ledger that powers most of crypto-fiat conversion today.",
    initials: "LV",
    tone: "bg-[#fbeadc] text-ink",
  },
  {
    name: "Priya Ravichandran",
    role: "Head of Compliance",
    bio: "Built BSA/AML programs at Coinbase and Square. CAMS, formerly with the U.S. Treasury's Office of Foreign Assets Control.",
    initials: "PR",
    tone: "bg-[#e3f5e8] text-ink",
  },
  {
    name: "Daniel Otieno",
    role: "Head of Engineering",
    bio: "Built payment rails for M-Pesa across East Africa. Believes deeply in the boring parts of finance.",
    initials: "DO",
    tone: "bg-[#f0e3fb] text-ink",
  },
];

/**
 * Each investor renders as either a wordmark image (when `lockup` is set)
 * or styled text (fallback). Drop a new SVG into /public/brand-mark/ and
 * point `lockup` at it to upgrade an entry from text to a real logo.
 */
const investors: { name: string; lockup?: string }[] = [
  { name: "Bessemer Venture Partners" },
  {
    name: "Stellar Development Foundation",
    lockup: "/brand-mark/stellar-foundation.svg",
  },
  { name: "Coinbase Ventures" },
  { name: "Multicoin Capital" },
  { name: "South Park Commons" },
];

export default function AboutPage() {
  return (
    <PageShell>
      <PageEnter>
        <PageMast
          eyebrow="About Useroutr"
          title={
            <>
              We&rsquo;re building the{" "}
              <span className="editorial-italic text-ink-2">last</span> payment
              processor your business will ever need.
            </>
          }
          description="One API for accepting and settling payments across every chain and every fiat rail. Settlement on-chain, audited, and built by people who have shipped payment infrastructure at the largest fintechs in the world."
        />

        {/* Story */}
        <section className="border-t border-rule py-20 md:py-28">
          <div className="container-x grid grid-cols-1 gap-12 md:grid-cols-12 md:gap-16">
            <div className="md:col-span-3">
              <div
                className="text-[11px] uppercase tracking-[0.16em] text-ink-3"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                The story
              </div>
            </div>
            <div className="md:col-span-9 max-w-[760px] space-y-5 text-[16px] leading-relaxed text-ink-2 md:text-[18px]">
              <p>
                We started Useroutr after watching the same problem repeat
                itself at every fintech we worked at: payments break across
                borders, custody concentrates risk, and every &ldquo;simple
                payment&rdquo; ends up stitched together from four vendors and
                a spreadsheet.
              </p>
              <p>
                The web3 payments wave promised to fix it. Cross-border
                settlement in seconds, fees measured in pennies, programmable
                money. But every product we tried held our funds, owned our
                customers, or required us to become money transmitters
                ourselves. The unit economics never worked.
              </p>
              <p>
                Useroutr is what we wished we&rsquo;d had. One API that takes
                payments in any currency, on any chain, and settles to wherever
                your business actually keeps money — without ever holding it
                in between.{" "}
                <span className="text-ink">
                  No custody. No surprises. No four-vendor stack.
                </span>
              </p>
            </div>
          </div>
        </section>

        {/* Principles */}
        <section className="border-t border-rule py-20 md:py-28">
          <div className="container-x">
            <div className="mx-auto max-w-[840px] text-center">
              <h2
                className="text-[34px] leading-[1.04] tracking-[-0.035em] text-ink md:text-[52px]"
                style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
              >
                What we{" "}
                <span className="editorial-italic text-ink-2">believe</span>.
              </h2>
            </div>
            <div className="mx-auto mt-14 grid max-w-[1080px] grid-cols-1 gap-5 md:mt-20 md:grid-cols-2">
              {principles.map((p, i) => (
                <div
                  key={p.title}
                  className="flex h-full flex-col gap-3 rounded-3xl border border-rule bg-bg-card p-7 md:p-8"
                >
                  <span
                    className="text-[11px] uppercase tracking-[0.16em] text-ink-3"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    [{String(i + 1).padStart(2, "0")}]
                  </span>
                  <h3
                    className="text-[20px] leading-[1.2] tracking-[-0.02em] text-ink md:text-[24px]"
                    style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
                  >
                    {p.title}
                  </h3>
                  <p className="text-[14.5px] leading-relaxed text-ink-2 md:text-[15.5px]">
                    {p.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Team */}
        <section className="border-t border-rule py-20 md:py-28">
          <div className="container-x">
            <div className="mx-auto max-w-[840px] text-center">
              <h2
                className="text-[34px] leading-[1.04] tracking-[-0.035em] text-ink md:text-[52px]"
                style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
              >
                Built by people who have{" "}
                <span className="editorial-italic text-ink-2">shipped</span>{" "}
                this before.
              </h2>
              <p className="mx-auto mt-5 max-w-[520px] text-[16px] leading-relaxed text-ink-2">
                The founding team has shipped payment products at Stripe,
                Plaid, Coinbase, Square, and M-Pesa.
              </p>
            </div>

            <div className="mx-auto mt-14 grid max-w-[1080px] grid-cols-1 gap-5 md:mt-20 md:grid-cols-2">
              {team.map((m) => (
                <div
                  key={m.name}
                  className="flex items-start gap-5 rounded-3xl border border-rule bg-bg-card p-6 md:p-7"
                >
                  <span
                    className={`grid size-14 shrink-0 place-items-center rounded-2xl text-[16px] font-medium ${m.tone}`}
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {m.initials}
                  </span>
                  <div className="flex-1">
                    <div className="text-[15px] font-medium text-ink">
                      {m.name}
                    </div>
                    <div
                      className="text-[11.5px] uppercase tracking-[0.14em] text-ink-3"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {m.role}
                    </div>
                    <p className="mt-3 text-[14px] leading-relaxed text-ink-2">
                      {m.bio}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mx-auto mt-12 max-w-[1080px] text-center">
              <Link
                href="mailto:hiring@useroutr.com"
                className="group inline-flex items-center gap-1.5 text-[14px] text-ink-2 transition-colors hover:text-ink"
              >
                <span className="link-underline">We&rsquo;re hiring</span>
                <ArrowUpRight
                  className="size-3.5 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  strokeWidth={1.6}
                />
              </Link>
            </div>
          </div>
        </section>

        {/* Investors */}
        <section className="border-t border-rule py-20 md:py-28">
          <div className="container-x">
            <div className="mx-auto max-w-[840px] text-center">
              <div
                className="text-[11px] uppercase tracking-[0.16em] text-ink-3"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                Backed by
              </div>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
                {investors.map((inv) =>
                  inv.lockup ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      key={inv.name}
                      src={inv.lockup}
                      alt={inv.name}
                      className="h-6 w-auto opacity-70 transition hover:opacity-100 md:h-7"
                      loading="lazy"
                    />
                  ) : (
                    <span
                      key={inv.name}
                      className="text-[18px] tracking-[-0.02em] text-ink-3 md:text-[22px]"
                      style={{
                        fontFamily: "var(--font-display)",
                        fontWeight: 500,
                      }}
                    >
                      {inv.name}
                    </span>
                  ),
                )}
              </div>
            </div>
          </div>
        </section>
      </PageEnter>
    </PageShell>
  );
}
