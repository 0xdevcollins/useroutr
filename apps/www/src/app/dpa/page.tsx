import type { Metadata } from "next";
import { PageShell } from "@/components/site/PageShell";
import { PageEnter } from "@/components/site/PageEnter";
import { LegalShell, type LegalSection } from "@/components/v2/LegalShell";

export const metadata: Metadata = {
  title: "Data Processing Agreement — Useroutr",
  description:
    "Useroutr's Data Processing Agreement for payment processing on behalf of customers, including subprocessors, transfers, and security measures.",
  alternates: { canonical: "/dpa" },
};

const sections: LegalSection[] = [
  {
    id: "roles",
    heading: "Roles",
    body: (
      <p>
        When you use Useroutr to process payments on behalf of your customers, you are the controller and Useroutr is the processor under GDPR Article 28 and UK GDPR Article 28. We only process personal data on your instructions.
      </p>
    ),
  },
  {
    id: "categories-of-data",
    heading: "Categories of data",
    body: (
      <ul className="list-disc space-y-2 pl-5 marker:text-ink-4">
        <li>Payer name and email address, and IP address when interacting with the checkout or dashboard.</li>
        <li>Payment amount, currency, timestamps, and transaction metadata you supply.</li>
        <li>KYB documents and identity information you provide to support onboarding.</li>
      </ul>
    ),
  },
  {
    id: "sub-processors",
    heading: "Sub-processors",
    body: (
      <>
        <p>We rely on a small set of subprocessors to run the service:</p>
        <ul className="list-disc space-y-2 pl-5 marker:text-ink-4">
          <li>Stripe (US, Standard Contractual Clauses)</li>
          <li>Circle (US, Standard Contractual Clauses)</li>
          <li>AWS infrastructure in eu-west-1 and us-east-1</li>
          <li>PostgreSQL on Supabase or on your AWS environment</li>
          <li>BullMQ job processing on AWS ElastiCache</li>
          <li>Resend transactional email (US, Standard Contractual Clauses)</li>
          <li>Better Stack monitoring and alerting (EU)</li>
        </ul>
      </>
    ),
  },
  {
    id: "international-transfers",
    heading: "International transfers",
    body: (
      <p>
        Standard Contractual Clauses are in place for US-based subprocessors. EU customers can request a data residency option for their production environment on request, subject to additional cost.
      </p>
    ),
  },
  {
    id: "security-measures",
    heading: "Security measures",
    body: (
      <ul className="list-disc space-y-2 pl-5 marker:text-ink-4">
        <li>TLS 1.3 for data in transit.</li>
        <li>AES-256-GCM encryption at rest for sensitive fields.</li>
        <li>Keys managed by AWS KMS and rotated according to our key management policy.</li>
        <li>Audit logs retained for 90 days standard, with 1 year retention available on Enterprise plans.</li>
      </ul>
    ),
  },
  {
    id: "data-retention",
    heading: "Data retention",
    body: (
      <>
        <p>Payment data is retained for 7 years to meet regulatory and accounting requirements.</p>
        <p>
          Personal data (PII) can be deleted on request within 30 days, except where retention is required by law, such as anti-money-laundering or accounting obligations.
        </p>
      </>
    ),
  },
  {
    id: "sub-processor-notification",
    heading: "Sub-processor notification",
    body: (
      <p>
        We will notify your billing contact by email at least 30 days before adding or materially changing a sub-processor. We also post updates to status.useroutr.com.
      </p>
    ),
  },
  {
    id: "audit-rights",
    heading: "Audit rights",
    body: (
      <p>
        An annual SOC 2 Type II report is available on request under NDA. Direct audits are available only on Enterprise plans with a mutual NDA and 30 days’ notice.
      </p>
    ),
  },
  {
    id: "signing",
    heading: "Signing",
    body: (
      <p>
        This DPA is auto-incorporated into Useroutr Terms. A standalone signed copy is available for procurement on request at{' '}
        <a
          href="mailto:legal@useroutr.com"
          className="text-ink underline decoration-rule-2 decoration-from-font underline-offset-4 hover:text-ink"
        >
          legal@useroutr.com
        </a>
        .
      </p>
    ),
  },
];

export default function DpaPage() {
  return (
    <PageShell>
      <PageEnter>
        <LegalShell
          title={
            <>
              Data Processing <span className="editorial-italic text-ink-2">Agreement</span>
            </>
          }
          intro="When you use Useroutr to process payments on behalf of your customers, you're the controller and we're the processor under GDPR Article 28 (and UK GDPR Article 28)."
          lastUpdated="May 29, 2026"
          sections={sections}
        />
      </PageEnter>
    </PageShell>
  );
}
