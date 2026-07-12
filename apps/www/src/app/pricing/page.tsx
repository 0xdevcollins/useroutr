import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/site/PageShell";
import { PageEnter } from "@/components/site/PageEnter";
import { PageMast } from "@/components/v2/PageMast";

export const metadata: Metadata = {
  title: "Pricing — Useroutr",
  description:
    "Published rates, locked for design partners. All-in payout pricing with the mid-market FX rate shown on every quote. No sales call, no contact-us.",
  alternates: { canonical: "/pricing" },
};

const rows: { what: string; price: string }[] = [
  {
    what: "Accept a payment (any supported chain → your settlement asset)",
    price: "0.9%",
  },
  { what: "Payout to a Stellar wallet", price: "$0.05 flat" },
  { what: "Payout to a bank account (NGN)", price: "0.8% + $0.20 · min $0.50" },
  { what: "Payout to mobile money (NGN)", price: "1.0% + $0.10 · min $0.30" },
  { what: "Refunds", price: "network cost only" },
  { what: "Sandbox & testnet", price: "free, unlimited" },
];

const faqs: { q: string; a: React.ReactNode }[] = [
  {
    q: "Do you have volume discounts?",
    a: "Yes — above $100k/month settled, payout rates drop; above $500k/month, pricing is custom. Both are published tiers, not negotiations.",
  },
  {
    q: "What happens when you add more corridors?",
    a: "Each corridor launches with its own published rate on this page before it goes live. Kenya and Ghana are next.",
  },
  {
    q: "Is the sandbox really free?",
    a: (
      <>
        Yes. Test keys (<code className="rounded bg-bg-soft px-1.5 py-0.5 text-[13px]" style={{ fontFamily: "var(--font-mono)" }}>ur_test_…</code>
        ), Stellar testnet, and the anchor sandbox — unlimited, no card, fully
        indexed so your CI can run against it.
      </>
    ),
  },
  {
    q: "What am I charged if a payout fails?",
    a: "Nothing. Failed payouts are automatically returned to your balance. You pay only when money is delivered.",
  },
];

export default function PricingPage() {
  return (
    <PageShell>
      <PageEnter>
        {/* Hero */}
        <PageMast
          eyebrow="Pricing"
          title={
            <>
              Pricing you can{" "}
              <span className="editorial-italic text-accent">read</span>.
            </>
          }
          description="No sales call, no “contact us.” These are our launch rates, locked for design partners."
        />

        {/* Rate table */}
        <section className="border-t border-rule py-16 md:py-24">
          <div className="container-x">
            <div className="mx-auto max-w-[820px]">
              <div className="overflow-hidden rounded-3xl border border-rule bg-bg-card">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-rule">
                      <th
                        className="px-6 py-4 text-[11px] uppercase tracking-[0.14em] text-ink-3"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        What
                      </th>
                      <th
                        className="px-6 py-4 text-right text-[11px] uppercase tracking-[0.14em] text-ink-3"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        Price
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr
                        key={r.what}
                        className="border-b border-rule last:border-b-0"
                      >
                        <td className="px-6 py-4 text-[14.5px] leading-relaxed text-ink md:text-[15px]">
                          {r.what}
                        </td>
                        <td
                          className="whitespace-nowrap px-6 py-4 text-right text-[14px] text-ink-2 md:text-[15px]"
                          style={{ fontFamily: "var(--font-mono)" }}
                        >
                          {r.price}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* Two promises */}
        <section className="border-t border-rule py-16 md:py-24">
          <div className="container-x">
            <div className="mx-auto grid max-w-[960px] grid-cols-1 gap-5 md:grid-cols-2">
              <div className="rounded-3xl border border-rule bg-bg-card p-7 md:p-8">
                <h2
                  className="text-[24px] leading-[1.1] tracking-[-0.03em] text-ink md:text-[28px]"
                  style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
                >
                  All-in means all-in.
                </h2>
                <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
                  The rate includes conversion and partner delivery fees. Stellar
                  network fees are under a cent — we absorb them. There is no
                  separate “FX fee” line, ever.
                </p>
              </div>
              <div className="rounded-3xl border border-accent bg-accent-soft/40 p-7 md:p-8">
                <h2
                  className="text-[24px] leading-[1.1] tracking-[-0.03em] text-ink md:text-[28px]"
                  style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
                >
                  The mid-market promise.
                </h2>
                <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
                  Every quote shows two numbers: our all-in rate, and the live
                  mid-market rate next to it. You always know exactly what the
                  spread is.{" "}
                  <span className="text-ink">
                    If we can&rsquo;t show you both numbers, we don&rsquo;t quote.
                  </span>
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-rule py-16 md:py-24">
          <div className="container-x">
            <div className="mx-auto max-w-[820px]">
              <h2
                className="text-[28px] leading-[1.06] tracking-[-0.035em] text-ink md:text-[40px]"
                style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
              >
                Questions
              </h2>
              <div className="mt-10 divide-y divide-rule border-y border-rule">
                {faqs.map((f) => (
                  <div key={f.q} className="py-6">
                    <h3 className="text-[16px] font-medium text-ink md:text-[17px]">
                      {f.q}
                    </h3>
                    <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2 md:text-[15px]">
                      {f.a}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-12 flex flex-wrap items-center gap-4">
                <Link
                  href="mailto:founders@useroutr.com"
                  className="pill pill-accent"
                >
                  Become a design partner →
                </Link>
                <Link
                  href="https://docs.useroutr.com"
                  target="_blank"
                  rel="noreferrer"
                  className="pill pill-light"
                >
                  Read the docs →
                </Link>
              </div>
            </div>
          </div>
        </section>
      </PageEnter>
    </PageShell>
  );
}
