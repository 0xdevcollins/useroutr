import type { Metadata } from "next";
import { PageShell } from "@/components/site/PageShell";
import { PageEnter } from "@/components/site/PageEnter";
import { LegalShell, type LegalSection } from "@/components/v2/LegalShell";

export const metadata: Metadata = {
  title: "Service Level Agreement — Useroutr",
  description:
    "Useroutr's Service Level Agreement for production uptime, latency targets, and exclusions.",
  alternates: { canonical: "/sla" },
};

const sections: LegalSection[] = [
  {
    id: "uptime",
    heading: "Uptime",
    body: (
      <p>
        We commit to 99.95% uptime on the public API, which is no more than 22 minutes of downtime per month. This is measured by external probes in Better Stack across six regions against the /readyz endpoint. The status page is the source of truth for availability.
      </p>
    ),
  },
  {
    id: "latency",
    heading: "Latency",
    body: (
      <>
        <p>
          Our SLA target for /v1/quotes is that 99th percentile latency stays within our published thresholds. Missed targets are remediated with credits at 10% of the monthly bill per 0.1% missed, up to 50% of the monthly bill total.
        </p>
        <p>Claims must be submitted in writing within 30 days of the incident.</p>
      </>
    ),
  },
  {
    id: "excluded-events",
    heading: "Excluded events",
    body: (
      <ul className="list-disc space-y-2 pl-5 marker:text-ink-4">
        <li>Force majeure events.</li>
        <li>Customer-side network issues or misconfigurations.</li>
        <li>Attacks or incidents Useroutr could not reasonably foresee.</li>
        <li>Sub-processor outages. We will share post-mortems, and any credits depend on the sub-processor’s own SLA.</li>
      </ul>
    ),
  },
];

export default function SlaPage() {
  return (
    <PageShell>
      <PageEnter>
        <LegalShell
          title={
            <>
              Service level <span className="editorial-italic text-ink-2">agreement</span>
            </>
          }
          intro="What we commit to in production, how we measure it, and what happens when we miss."
          lastUpdated="May 29, 2026"
          sections={sections}
        />
      </PageEnter>
    </PageShell>
  );
}
