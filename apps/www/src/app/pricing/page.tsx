import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/site/PageShell";
import { PageEnter } from "@/components/site/PageEnter";
import { PageMast } from "@/components/v2/PageMast";

export const metadata: Metadata = {
  title: "Pricing — Useroutr",
  description:
    "One per-transaction fee, the same on every rail. Network costs pass through at cost — we never mark up the underlying chain or fiat rail.",
  alternates: { canonical: "/pricing" },
};

const checklist = [
  "All payment methods (card, bank, crypto, mobile money)",
  "Hosted checkout + pay-by-link + invoices",
  "Global payouts to 174 countries",
  "Managed Stellar settlement wallet",
  "Webhooks + SDKs + sandbox",
  "Standard support (email, 1 business day)",
];

const rails: { method: string; cost: string }[] = [
  { method: "Card payments (Stripe)", cost: "network fee pass-through, no markup" },
  { method: "Bank transfers (ACH, SEPA)", cost: "network fee pass-through, no markup" },
  { method: "Crypto payments (CCTP V2)", cost: "Circle protocol fee pass-through" },
  { method: "Mobile money (M-Pesa, MTN)", cost: "rail fee pass-through" },
  { method: "Payouts", cost: "included in 0.5%" },
  { method: "FX conversion", cost: "mid-market rate + 30 bps" },
  { method: "Sandbox", cost: "free, unlimited" },
  { method: "Webhook retries", cost: "included, exhaustion after 10 attempts" },
];

const volumeTiers = [
  { threshold: "> $50k / mo", rate: "0.35%" },
  { threshold: "> $500k / mo", rate: "0.30%" },
  { threshold: "> $5M / mo", rate: "Let\u2019s talk", cta: true },
];

const neverCharge = [
  "Setup fees",
  "Monthly minimums",
  "Hidden FX spreads",
  "\u201CExpress settlement\u201D premiums",
  "Disputes you win",
  "Sandbox usage",
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
              Plain pricing.{" "}
              <span className="editorial-italic text-ink-2">
                No revenue share.
              </span>
            </>
          }
          description="What you'd hope a payment processor would do. One per-transaction fee, the same on every rail. Network costs pass through at cost — we never mark up the underlying chain or fiat rail."
        />

        {/* Starter tier card */}
        <section className="border-t border-rule py-20 md:py-28">
          <div className="container-x">
            <div className="mx-auto max-w-[760px]">
              <div className="rounded-3xl border border-accent bg-bg-card p-7 md:p-8">
                <span
                  className="inline-block rounded-full bg-accent-soft px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-accent-ink"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  The one plan
                </span>

                <div
                  className="mt-5 text-[11px] uppercase tracking-[0.16em] text-ink-3"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  Starter
                </div>

                <div className="mt-3 flex items-baseline gap-2">
                  <span
                    className="text-[52px] leading-[1] tracking-[-0.04em] text-ink md:text-[64px]"
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 600,
                    }}
                  >
                    0.5%
                  </span>
                  <span className="text-[16px] text-ink-2 md:text-[18px]">
                    per transaction
                  </span>
                </div>

                <p
                  className="mt-3 text-[13px] text-ink-3"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  ↓ drops to 0.35% above $50,000&thinsp;/&thinsp;month
                </p>

                <ul className="mt-8 space-y-3">
                  {checklist.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-3 text-[14.5px] leading-relaxed text-ink-2 md:text-[15.5px]"
                    >
                      <span className="mt-0.5 text-accent" aria-hidden>
                        ✓
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>

                <div className="mt-8">
                  <Link
                    href="mailto:hello@useroutr.com"
                    className="pill pill-accent"
                  >
                    Start building →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Add-on table */}
        <section className="border-t border-rule py-20 md:py-28">
          <div className="container-x">
            <div className="mx-auto max-w-[960px]">
              <h2
                className="text-[34px] leading-[1.04] tracking-[-0.035em] text-ink md:text-[52px]"
                style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
              >
                What you pay{" "}
                <span className="editorial-italic text-ink-2">per rail</span>.
              </h2>

              <div className="mt-12 overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-rule">
                      <th
                        className="pb-3 text-[11px] uppercase tracking-[0.14em] text-ink-3"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        Method
                      </th>
                      <th
                        className="pb-3 text-right text-[11px] uppercase tracking-[0.14em] text-ink-3"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        Cost
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rails.map((r) => (
                      <tr key={r.method} className="border-b border-rule">
                        <td className="py-4 text-[14.5px] text-ink md:text-[15.5px]">
                          {r.method}
                        </td>
                        <td className="py-4 text-right text-[14px] text-ink-2 md:text-[15px]">
                          {r.cost}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* Volume pricing strip */}
        <section className="border-t border-rule py-20 md:py-28">
          <div className="container-x">
            <div className="mx-auto max-w-[960px]">
              <h2
                className="text-center text-[34px] leading-[1.04] tracking-[-0.035em] text-ink md:text-[52px]"
                style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
              >
                Grows{" "}
                <span className="editorial-italic text-ink-2">with you</span>.
              </h2>

              <div className="mx-auto mt-14 grid max-w-[1080px] grid-cols-1 gap-5 md:mt-20 md:grid-cols-3">
                {volumeTiers.map((tier) => (
                  <div
                    key={tier.threshold}
                    className="flex flex-col items-center gap-3 rounded-3xl border border-rule bg-bg-card p-7 text-center md:p-8"
                  >
                    <span
                      className="text-[11px] uppercase tracking-[0.16em] text-ink-3"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {tier.threshold}
                    </span>
                    <span
                      className="text-[44px] leading-[1] tracking-[-0.04em] text-ink md:text-[56px]"
                      style={{
                        fontFamily: "var(--font-display)",
                        fontWeight: 600,
                      }}
                    >
                      {tier.rate}
                    </span>
                    {tier.cta && (
                      <Link
                        href="mailto:sales@useroutr.com"
                        className="mt-2 text-[13.5px] text-ink-2 transition-colors hover:text-ink"
                      >
                        <span className="link-underline">Contact sales →</span>
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* What we don't charge for */}
        <section className="border-t border-rule py-20 md:py-28">
          <div className="container-x">
            <div className="mx-auto max-w-[960px]">
              <h2
                className="text-[34px] leading-[1.04] tracking-[-0.035em] text-ink md:text-[52px]"
                style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
              >
                What we{" "}
                <span className="editorial-italic text-ink-2">
                  don&rsquo;t
                </span>{" "}
                charge for.
              </h2>

              <div className="mt-12 grid grid-cols-1 gap-x-12 gap-y-5 md:grid-cols-2">
                {neverCharge.map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 border-b border-rule py-4"
                  >
                    <span
                      className="text-[16px] text-ink-4"
                      aria-hidden
                    >
                      ✕
                    </span>
                    <span className="text-[15px] text-ink-2 line-through decoration-rule-2">
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Enterprise card */}
        <section className="border-t border-rule py-20 md:py-28">
          <div className="container-x">
            <div className="mx-auto max-w-[960px]">
              <div className="rounded-3xl border border-rule bg-bg-card p-7 md:p-10">
                <div
                  className="text-[11px] uppercase tracking-[0.16em] text-ink-3"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  Enterprise
                </div>

                <h2
                  className="mt-5 text-[28px] leading-[1.08] tracking-[-0.035em] text-ink md:text-[40px]"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 600,
                  }}
                >
                  Custom pricing for teams over $5M&thinsp;/&thinsp;month.
                </h2>

                <p className="mt-5 max-w-[640px] text-[15px] leading-relaxed text-ink-2 md:text-[16px]">
                  Dedicated support, custom SLAs, multi-entity contracts,
                  on-prem audit logs export, KYB review of integrators on your
                  platform.
                </p>

                <div className="mt-8">
                  <Link
                    href="mailto:sales@useroutr.com"
                    className="pill pill-dark"
                  >
                    Talk to the team →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </PageEnter>
    </PageShell>
  );
}
