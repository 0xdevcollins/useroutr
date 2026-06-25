import type { Metadata } from "next";
import { PageShell } from "@/components/site/PageShell";
import { PageEnter } from "@/components/site/PageEnter";
import { LegalShell, type LegalSection } from "@/components/v2/LegalShell";

export const metadata: Metadata = {
  title: "Privacy Policy — Useroutr",
  description:
    "How Useroutr Labs, Inc. collects, uses, and protects personal information across the Useroutr platform and services.",
  alternates: { canonical: "/privacy" },
};

const sections: LegalSection[] = [
  {
    id: "scope",
    heading: "Scope of this policy",
    body: (
      <p>
        This Privacy Policy describes how Useroutr Labs, Inc.
        (&ldquo;Useroutr&rdquo;, &ldquo;we&rdquo;) collects, uses, discloses,
        and protects personal information when you use our website, dashboard,
        APIs, hosted checkout, and related services (collectively, the
        &ldquo;Services&rdquo;).
      </p>
    ),
  },
  {
    id: "collect",
    heading: "Information we collect",
    body: (
      <>
        <p>
          <strong className="font-medium text-ink">Account information.</strong>{" "}
          When you create an account, we collect business name, legal entity,
          beneficial owners, business address, contact name, email, and phone.
          For regulated activities we may also collect government identifiers
          and supporting documents to verify identity.
        </p>
        <p>
          <strong className="font-medium text-ink">Transaction data.</strong>{" "}
          We process payment, payout, and settlement metadata — amounts,
          currencies, counterparties, timestamps, network identifiers — needed
          to deliver the Services and comply with applicable financial laws.
        </p>
        <p>
          <strong className="font-medium text-ink">Technical data.</strong> IP
          address, device type, browser, pages visited, and similar diagnostic
          information collected automatically when you use the dashboard or
          hosted checkout pages.
        </p>
      </>
    ),
  },
  {
    id: "use",
    heading: "How we use information",
    body: (
      <ul className="list-disc space-y-2 pl-5 marker:text-ink-4">
        <li>To provide, maintain, and improve the Services.</li>
        <li>To onboard and verify accounts, including KYB and sanctions screening.</li>
        <li>To process payments, payouts, and settlements you initiate.</li>
        <li>To detect, prevent, and investigate fraud, abuse, or security incidents.</li>
        <li>
          To comply with legal obligations (recordkeeping, suspicious activity
          reporting, tax reporting, lawful requests from authorities).
        </li>
        <li>
          To communicate with you about your account, security, product
          changes, and — with your consent — marketing.
        </li>
      </ul>
    ),
  },
  {
    id: "sharing",
    heading: "Sharing & disclosure",
    body: (
      <>
        <p>
          We share personal information only as needed to operate the Services:
          with payment networks and financial-rail partners (Stellar, Circle,
          MoneyGram, Visa Direct, banking partners), KYC/AML vendors, cloud
          infrastructure providers, and analytics tools, each bound by
          confidentiality and data-protection obligations.
        </p>
        <p>
          We may disclose information in response to a lawful request from a
          government, regulator, or court, or where we reasonably believe
          disclosure is necessary to prevent harm or fraud.
        </p>
        <p>
          We do not sell personal information.
        </p>
      </>
    ),
  },
  {
    id: "transfers",
    heading: "International transfers",
    body: (
      <p>
        Useroutr is headquartered in the United States, and we may process
        personal information in the United States and other jurisdictions where
        our partners operate. Where data is transferred from regions with
        cross-border-transfer restrictions (EU/EEA, UK, etc.), we use
        appropriate safeguards such as Standard Contractual Clauses.
      </p>
    ),
  },
  {
    id: "retention",
    heading: "Data retention",
    body: (
      <p>
        We retain personal information for as long as needed to provide the
        Services and to comply with legal, accounting, or reporting
        obligations. Transaction records are typically retained for at least
        five years from the date of the transaction, in line with U.S. and
        international financial-recordkeeping rules.
      </p>
    ),
  },
  {
    id: "rights",
    heading: "Your rights",
    body: (
      <>
        <p>
          Depending on your jurisdiction, you may have rights to access,
          correct, delete, port, or restrict processing of your personal
          information, and to withdraw consent for marketing communications.
        </p>
        <p>
          To exercise these rights, email{" "}
          <a
            href="mailto:privacy@useroutr.com"
            className="text-ink underline decoration-rule-2 decoration-from-font underline-offset-4 hover:text-ink"
          >
            privacy@useroutr.com
          </a>
          . We will respond within the timeframes required by applicable law.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    heading: "Cookies & tracking",
    body: (
      <p>
        We use essential cookies to authenticate sessions and operate the
        dashboard, plus a limited set of analytics cookies to understand
        product usage. We do not use third-party advertising cookies. You can
        manage cookies in your browser settings.
      </p>
    ),
  },
  {
    id: "children",
    heading: "Children’s privacy",
    body: (
      <p>
        The Services are not directed to children under 18. We do not
        knowingly collect personal information from children. If you believe a
        child has provided personal information, contact us and we will delete
        it.
      </p>
    ),
  },
  {
    id: "contact",
    heading: "Contact",
    body: (
      <p>
        For any privacy question, contact us at{" "}
        <a
          href="mailto:privacy@useroutr.com"
          className="text-ink underline decoration-rule-2 decoration-from-font underline-offset-4 hover:text-ink"
        >
          privacy@useroutr.com
        </a>{" "}
        or by mail at Useroutr Labs, Inc., 548 Market Street #95612, San
        Francisco, CA 94104.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <PageShell>
      <PageEnter>
        <LegalShell
          title={
            <>
              Privacy{" "}
              <span className="editorial-italic text-ink-2">Policy</span>
            </>
          }
          intro="How we collect, use, and protect personal information across the Useroutr platform."
          lastUpdated="May 1, 2026"
          sections={sections}
        />
      </PageEnter>
    </PageShell>
  );
}
