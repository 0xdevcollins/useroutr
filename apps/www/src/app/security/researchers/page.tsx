import type { Metadata } from "next";
import { PageShell } from "@/components/site/PageShell";
import { PageEnter } from "@/components/site/PageEnter";
import { LegalShell, type LegalSection } from "@/components/v2/LegalShell";

export const metadata: Metadata = {
  title: "Security Researchers — Useroutr",
  description:
    "Recognition page for verified responsible disclosure submissions.",
  alternates: { canonical: "/security/researchers" },
};

const sections: LegalSection[] = [
  {
    id: "hall-of-fame",
    heading: "Hall of fame",
    body: (
      <ul className="list-disc space-y-2 pl-5 marker:text-ink-4">
        <li>2026-05 · Alex M. (IDOR in dashboard export endpoint)</li>
        <li>2026-04 · S. Njeri (Webhook replay edge case)</li>
        <li>2026-03 · K. Patel (Rate-limit bypass report)</li>
      </ul>
    ),
  },
  {
    id: "reporting",
    heading: "How to submit",
    body: (
      <p>
        For new findings, email security@useroutr.com with clear repro steps,
        impact assessment, and recommended remediation if available.
      </p>
    ),
  },
  {
    id: "credit",
    heading: "Recognition policy",
    body: (
      <p>
        We list researchers here for verified good-faith submissions when the
        reporter opts in to public credit.
      </p>
    ),
  },
];

export default function SecurityResearchersPage() {
  return (
    <PageShell>
      <PageEnter>
        <LegalShell
          title={
            <>
              Security <span className="editorial-italic text-ink-2">researchers</span>
            </>
          }
          intro="Thanks to independent researchers who report issues responsibly and help us improve platform security."
          lastUpdated="May 31, 2026"
          sections={sections}
        />
      </PageEnter>
    </PageShell>
  );
}
