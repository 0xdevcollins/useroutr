import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PageShell } from "@/components/site/PageShell";
import { PageEnter } from "@/components/site/PageEnter";
import { PageMast } from "@/components/v2/PageMast";
import { INTEGRATIONS, type Integration } from "@/lib/integrations";

const publicIntegrationsDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../public/integrations",
);

const availableLogos = new Set(
  fs.existsSync(publicIntegrationsDir)
    ? fs.readdirSync(publicIntegrationsDir).filter((fileName) => fileName.endsWith(".svg"))
    : [],
);

const statusStyles: Record<Integration["status"], string> = {
  live: "bg-emerald-100 text-emerald-900",
  "coming-soon": "bg-amber-100 text-amber-900",
  "on-request": "bg-slate-100 text-slate-900",
};

const statusLabel: Record<Integration["status"], string> = {
  live: "Live",
  "coming-soon": "Coming soon",
  "on-request": "On request",
};

function getInitials(name: string) {
  return name
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 2)
    .toUpperCase();
}

function hasLogo(slug: string) {
  return availableLogos.has(`${slug}.svg`);
}

const categoryGroups = INTEGRATIONS.reduce<Record<string, Integration[]>>((groups, integration) => {
  (groups[integration.category] ??= []).push(integration);
  return groups;
}, {});

const categories = Object.entries(categoryGroups);

export const metadata: Metadata = {
  title: "Integrations | Useroutr",
  description:
    "Connect Useroutr to your accounting, treasury, billing, support, and dev tools.",
};

export default async function IntegrationsPage() {
  return (
    <PageShell>
      <PageEnter>
        <PageMast
          eyebrow="Integrations"
          title="Plugged into the rails you already use."
          description="One integration to Useroutr, fifty integrations to the rest of your stack. Connect Useroutr to your accounting, treasury, billing, support, and dev tools. Most integrations are read-only sync; some support write-back for refunds, reconciliation, and payouts."
        />

        <section className="border-t border-rule py-20 md:py-28">
          <div className="container-x">
            <div className="space-y-20">
              {categories.map(([category, items]) => (
                <div key={category} className="space-y-8">
                  <h2
                    className="text-[24px] leading-[1.08] tracking-[-0.03em] text-ink md:text-[32px]"
                    style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
                  >
                    {category}
                  </h2>
                  <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {items.map((integration) => (
                      <div
                        key={integration.id}
                        className="rounded-[28px] border border-rule bg-bg-card p-7"
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-bg">
                            {hasLogo(integration.logoSlug) ? (
                              <Image
                                src={`/integrations/${integration.logoSlug}.svg`}
                                alt={`${integration.name} logo`}
                                width={40}
                                height={40}
                                className="max-h-10 max-w-10"
                              />
                            ) : (
                              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
                                {getInitials(integration.name)}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-3">
                              <h3
                                className="text-[18px] leading-[1.18] tracking-[-0.02em] text-ink"
                                style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
                              >
                                {integration.name}
                              </h3>
                              <span
                                className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${statusStyles[integration.status]}`}
                              >
                                {statusLabel[integration.status]}
                              </span>
                            </div>
                            <p className="mt-4 text-[15px] leading-relaxed text-ink-3">
                              {integration.description || "More details coming soon."}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div className="grid gap-5 lg:grid-cols-2">
                <div className="rounded-[28px] border border-rule bg-bg-card p-8">
                  <p className="text-[18px] font-semibold text-ink">Don't see yours?</p>
                  <p className="mt-3 text-[15px] leading-relaxed text-ink-3">
                    Request an integration from the Useroutr team, and we’ll follow up with next steps.
                  </p>
                  <div className="mt-6">
                    <Link
                      href="mailto:integrations@useroutr.com"
                      className="inline-flex items-center gap-2 text-[15px] text-ink transition hover:text-ink-2"
                    >
                      Request an integration
                      <ArrowUpRight className="size-4" strokeWidth={1.6} />
                    </Link>
                  </div>
                </div>

                <div className="rounded-[28px] border border-rule bg-bg-card p-8">
                  <p className="text-[18px] font-semibold text-ink">Build your own</p>
                  <p className="mt-3 text-[15px] leading-relaxed text-ink-3">
                    Use Useroutr's API docs to connect your internal systems or build a custom integration.
                  </p>
                  <div className="mt-6">
                    <Link
                      href="/docs/api"
                      className="inline-flex items-center gap-2 text-[15px] text-ink transition hover:text-ink-2"
                    >
                      Read the API docs
                      <ArrowUpRight className="size-4" strokeWidth={1.6} />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </PageEnter>
    </PageShell>
  );
}
