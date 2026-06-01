import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PageShell } from "@/components/site/PageShell";
import { PageEnter } from "@/components/site/PageEnter";
import { PageMast } from "@/components/v2/PageMast";
import { BrandLogo } from "@/components/v2/BrandLogo";

export const metadata: Metadata = {
  title: "Integrations — Useroutr",
  description:
    "Connect Useroutr to accounting, ERP, communication, and automation tools your team already uses.",
  alternates: { canonical: "/integrations" },
};

const integrationGroups = [
  {
    title: "Accounting and ERP",
    items: ["quickbooks", "xero", "netsuite"],
  },
  {
    title: "Automation and workflows",
    items: ["zapier", "notion", "webhooks"],
  },
  {
    title: "Ops and communication",
    items: ["slack", "github"],
  },
  {
    title: "Payments and rails",
    items: ["stripe", "moneygram", "stellar"],
  },
] as const;

export default function IntegrationsPage() {
  return (
    <PageShell>
      <PageEnter>
        <PageMast
          eyebrow="Integrations"
          title={
            <>
              Works with the stack you already <span className="editorial-italic text-ink-2">run</span>.
            </>
          }
          description="Connect operations, accounting, and notifications without building one-off glue code. Use native integrations where available and webhooks for everything else."
        />

        <section className="border-t border-rule py-20 md:py-28">
          <div className="container-x space-y-12 md:space-y-16">
            {integrationGroups.map((group) => (
              <div key={group.title} className="rounded-3xl border border-rule bg-bg-card p-7 md:p-8">
                <h2
                  className="text-[26px] leading-[1.1] tracking-[-0.025em] text-ink md:text-[34px]"
                  style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
                >
                  {group.title}
                </h2>
                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {group.items.map((id) => (
                    <div
                      key={id}
                      className="flex items-center gap-3 rounded-2xl border border-rule bg-bg-soft/40 px-4 py-3"
                    >
                      <BrandLogo id={id} size="sm" framed shape="rounded" />
                      <span className="text-[14px] text-ink" style={{ fontFamily: "var(--font-display)" }}>
                        {id.replace("-", " ")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-rule py-20 md:py-24">
          <div className="container-x text-center">
            <h2
              className="text-[30px] leading-[1.08] tracking-[-0.03em] text-ink md:text-[44px]"
              style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
            >
              Need a custom integration?
            </h2>
            <p className="mx-auto mt-5 max-w-[640px] text-[16px] leading-relaxed text-ink-2 md:text-[18px]">
              Every payment and payout transition emits a typed webhook payload. Most teams ship custom integrations in less than a week.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-5">
              <Link
                href="https://docs.useroutr.com/webhooks"
                target="_blank"
                rel="noreferrer"
                className="group inline-flex items-center gap-1 text-[14px] text-ink-2 transition-colors hover:text-ink"
              >
                <span className="link-underline">Read webhook docs</span>
                <ArrowUpRight className="size-3.5 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
              <Link href="/contact" className="pill pill-dark py-2.5 text-[13px]">
                Talk to integrations team
              </Link>
            </div>
          </div>
        </section>
      </PageEnter>
    </PageShell>
  );
}
