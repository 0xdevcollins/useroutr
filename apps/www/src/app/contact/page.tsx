import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PageShell } from "@/components/site/PageShell";
import { PageEnter } from "@/components/site/PageEnter";
import { PageMast } from "@/components/v2/PageMast";

export const metadata: Metadata = {
  title: "Contact — Useroutr",
  description:
    "Talk to sales, get support, or reach out about partnerships and press. We're easy to reach.",
  alternates: { canonical: "/contact" },
};

const intents = [
  {
    index: "01",
    title: "Talk to sales",
    body: "Implementation calls. KYB review. Volume pricing. For teams that want a payment processor with a real engineering counterpart, not a chatbot. Schedule a 30-minute call — same week, no demos.",
    cta: { label: "Book a call", href: "https://cal.com/useroutr/sales", external: true },
    tone: "bg-[#e8eafb]",
  },
  {
    index: "02",
    title: "Get support",
    body: "Already a customer. Something's broken. Support is included in every plan. We monitor #support in your shared Slack and answer email within 1 business day. Anything blocking production gets pager-class response.",
    links: [
      { label: "support@useroutr.com", href: "mailto:support@useroutr.com" },
      { label: "Status page", href: "https://status.useroutr.com", external: true },
    ],
    tone: "bg-[#e3f5e8]",
  },
  {
    index: "03",
    title: "Partnerships & press",
    body: "Integrations, co-marketing, press inquiries. If we should be working together — payment rails, accounting partners, infra vendors, journalists writing about stablecoin infra — say hi.",
    links: [
      { label: "hello@useroutr.com", href: "mailto:hello@useroutr.com" },
    ],
    tone: "bg-[#fbeadc]",
  },
];

const offices = [
  {
    label: "HQ",
    name: "Useroutr Labs, Inc.",
    address: "[Address — replace before launch]",
  },
  {
    label: "EU operations",
    name: "Useroutr Labs EU",
    address: "[Address — replace before launch]",
  },
  {
    label: "Africa operations",
    name: "Useroutr Labs Africa",
    address: "[Address — replace before launch]",
  },
];

export default function ContactPage() {
  return (
    <PageShell>
      <PageEnter>
        <PageMast
          eyebrow="Contact"
          title={
            <>
              We&rsquo;re easy{" "}
              <span className="editorial-italic text-ink-2">to reach.</span>
            </>
          }
          description="Pick the door that fits the conversation."
        />

        {/* Intent cards */}
        <section className="border-t border-rule py-20 md:py-28">
          <div className="container-x">
            <div className="mx-auto grid max-w-[1080px] grid-cols-1 gap-5 md:grid-cols-3">
              {intents.map((intent) => (
                <div
                  key={intent.index}
                  className="flex h-full flex-col gap-4 rounded-3xl border border-rule bg-bg-card p-7 md:p-8"
                >
                  <span
                    className="text-[11px] uppercase tracking-[0.16em] text-ink-3"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    [{intent.index}]
                  </span>
                  <div
                    className={`inline-flex w-fit items-center rounded-xl px-3 py-1.5 text-[12px] font-medium text-ink ${intent.tone}`}
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {intent.title}
                  </div>
                  <p className="flex-1 text-[14.5px] leading-relaxed text-ink-2 md:text-[15px]">
                    {intent.body}
                  </p>
                  <div className="flex flex-col gap-2 pt-1">
                    {intent.cta && (
                      <Link
                        href={intent.cta.href}
                        target="_blank"
                        rel="noreferrer"
                        className="group inline-flex items-center gap-1.5 text-[13.5px] font-medium text-ink transition-colors hover:text-ink-2"
                      >
                        <span className="link-underline">{intent.cta.label}</span>
                        <ArrowUpRight
                          className="size-3.5 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                          strokeWidth={1.6}
                        />
                      </Link>
                    )}
                    {intent.links?.map((l) => (
                      <Link
                        key={l.href}
                        href={l.href}
                        target={l.external ? "_blank" : undefined}
                        rel={l.external ? "noreferrer" : undefined}
                        className="group inline-flex items-center gap-1.5 text-[13.5px] text-ink-2 transition-colors hover:text-ink"
                        style={!l.external ? { fontFamily: "var(--font-mono)", fontSize: "12.5px" } : undefined}
                      >
                        <span className="link-underline">{l.label}</span>
                        {l.external && (
                          <ArrowUpRight
                            className="size-3 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                            strokeWidth={1.6}
                          />
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Office strip */}
        <section className="border-t border-rule py-20 md:py-28">
          <div className="container-x">
            <div className="mx-auto max-w-[1080px]">
              <div
                className="text-[11px] uppercase tracking-[0.16em] text-ink-3"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                Offices
              </div>
              <p className="mt-4 max-w-[560px] text-[14px] leading-relaxed text-ink-3">
                We&rsquo;re a remote-first team. The addresses are for compliance
                correspondence only — please don&rsquo;t drop by.
              </p>
              <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
                {offices.map((office) => (
                  <div
                    key={office.label}
                    className="rounded-2xl border border-rule bg-bg-card p-6"
                  >
                    <div
                      className="text-[11px] uppercase tracking-[0.14em] text-ink-3"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {office.label}
                    </div>
                    <div className="mt-3 text-[14px] font-medium text-ink">
                      {office.name}
                    </div>
                    <div className="mt-1 text-[13px] leading-relaxed text-ink-3">
                      {office.address}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Security disclosures */}
        <section className="border-t border-rule py-20 md:py-28">
          <div className="container-x">
            <div className="mx-auto max-w-[1080px]">
              <div className="rounded-3xl border border-rule bg-bg-card p-8 md:p-10">
                <div
                  className="text-[11px] uppercase tracking-[0.16em] text-ink-3"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  Security disclosures
                </div>
                <h2
                  className="mt-4 text-[24px] leading-[1.15] tracking-[-0.025em] text-ink md:text-[30px]"
                  style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
                >
                  Found a vulnerability?
                </h2>
                <p className="mt-3 max-w-[560px] text-[15px] leading-relaxed text-ink-2">
                  Don&rsquo;t email it to support. Use the responsible-disclosure
                  channel. We take security reports seriously and respond within
                  24 hours.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
                  <Link
                    href="mailto:security@useroutr.com"
                    className="inline-flex items-center gap-1.5 text-[13px] text-ink transition-colors hover:text-ink-2"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    security@useroutr.com
                  </Link>
                  <Link
                    href="/security"
                    className="group inline-flex items-center gap-1.5 text-[13.5px] text-ink-2 transition-colors hover:text-ink"
                  >
                    <span className="link-underline">Responsible disclosure policy</span>
                    <ArrowUpRight
                      className="size-3.5 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                      strokeWidth={1.6}
                    />
                  </Link>
                  <span className="text-[13px] text-ink-3 transition-colors hover:text-ink-2 cursor-pointer">
                    PGP fingerprint →
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </PageEnter>
    </PageShell>
  );
}
