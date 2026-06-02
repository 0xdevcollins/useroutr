import type { Metadata } from "next";
import { PageShell } from "@/components/site/PageShell";
import { PageEnter } from "@/components/site/PageEnter";
import { PageMast } from "@/components/v2/PageMast";

export const metadata: Metadata = {
  title: "Contact — Useroutr",
  description:
    "Talk to sales, partnerships, security, legal, or support at Useroutr.",
  alternates: { canonical: "/contact" },
};

const contacts = [
  {
    team: "Sales",
    email: "sales@useroutr.com",
    note: "Pricing, rollout plans, and commercial terms.",
  },
  {
    team: "Partnerships",
    email: "partnerships@useroutr.com",
    note: "Distribution, ecosystem, and strategic partner programs.",
  },
  {
    team: "Support",
    email: "support@useroutr.com",
    note: "Integration questions and production troubleshooting.",
  },
  {
    team: "Security",
    email: "security@useroutr.com",
    note: "Vulnerability reports and disclosure coordination.",
  },
  {
    team: "Legal",
    email: "legal@useroutr.com",
    note: "DPA requests, procurement, and contract questions.",
  },
] as const;

export default function ContactPage() {
  return (
    <PageShell>
      <PageEnter>
        <PageMast
          eyebrow="Contact"
          title={
            <>
              Reach the right team in <span className="editorial-italic text-ink-2">one step</span>.
            </>
          }
          description="Whether you are evaluating Useroutr, integrating in production, or completing procurement, we route your message to the owner quickly."
        />

        <section className="border-t border-rule py-20 md:py-28">
          <div className="container-x">
            <div className="mx-auto grid max-w-[1000px] grid-cols-1 gap-5 md:grid-cols-2">
              {contacts.map((entry) => (
                <article key={entry.team} className="rounded-3xl border border-rule bg-bg-card p-7 md:p-8">
                  <span
                    className="text-[11px] uppercase tracking-[0.16em] text-ink-3"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {entry.team}
                  </span>
                  <a
                    href={`mailto:${entry.email}`}
                    className="mt-3 block text-[24px] leading-[1.15] tracking-[-0.02em] text-ink underline decoration-rule-2 decoration-from-font underline-offset-4"
                    style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
                  >
                    {entry.email}
                  </a>
                  <p className="mt-4 text-[15px] leading-relaxed text-ink-2">{entry.note}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </PageEnter>
    </PageShell>
  );
}
