import type { Metadata } from "next";
import { PageShell } from "@/components/site/PageShell";
import { PageEnter } from "@/components/site/PageEnter";
import { LegalShell, type LegalSection } from "@/components/v2/LegalShell";

export const metadata: Metadata = {
  title: "Compliance — Useroutr",
  description:
    "Licensing, KYC/KYB, sanctions screening, AML monitoring, travel-rule support, and reporting at Useroutr.",
  alternates: { canonical: "/compliance" },
};

const sections: LegalSection[] = [
  {
    id: "licensing",
    heading: "Licensing & registrations",
    body: (
      <>
        <p>
          Useroutr Labs, Inc. is registered with the U.S. Financial Crimes
          Enforcement Network (FinCEN) as a Money Services Business
          (MSB&nbsp;31000-258XX). State money-transmitter licensure is in
          progress; we partner with regulated banking and money-services
          partners where required by local law.
        </p>
        <p>
          We maintain similar partnerships and registrations in the EU/EEA, UK,
          Nigeria, Kenya, and other jurisdictions where the Services are
          offered. A current list is available on request.
        </p>
      </>
    ),
  },
  {
    id: "kyc-kyb",
    heading: "KYC & KYB",
    body: (
      <>
        <p>
          Every business that uses Useroutr completes a Know-Your-Business
          (KYB) review covering legal entity, ownership structure, beneficial
          owners, and intended use case. Higher-risk verticals (regulated
          finance, marketplaces handling consumer funds, etc.) get enhanced
          due diligence.
        </p>
        <p>
          For consumer-facing flows, we provide a KYC SDK and hosted flow that
          satisfies CIP requirements in the U.S. and equivalent rules
          elsewhere — passport, government ID, selfie liveness, and address
          verification — backed by tier-1 identity providers.
        </p>
      </>
    ),
  },
  {
    id: "sanctions",
    heading: "Sanctions screening",
    body: (
      <p>
        We screen all account holders, beneficial owners, and counterparties
        against OFAC, EU, UK HMT, UN, and other applicable sanctions lists, at
        onboarding and continuously thereafter. Transactions involving
        sanctioned parties or jurisdictions are blocked at the protocol level.
      </p>
    ),
  },
  {
    id: "aml",
    heading: "AML & transaction monitoring",
    body: (
      <>
        <p>
          Our anti-money-laundering program is overseen by a designated AML
          officer and reviewed annually by an independent third party. We
          maintain transaction-monitoring rules that flag unusual velocity,
          structuring, high-risk geographies, and counterparties associated
          with on-chain illicit activity.
        </p>
        <p>
          Suspicious activity reports (SARs) are filed with FinCEN and
          equivalent foreign authorities when applicable. We do not notify
          customers of SAR filings.
        </p>
      </>
    ),
  },
  {
    id: "travel-rule",
    heading: "Travel rule",
    body: (
      <p>
        For virtual-asset transfers subject to the FATF travel rule, Useroutr
        exchanges required originator and beneficiary information with
        counterparty VASPs using a standardized protocol (Sumsub TRP,
        Notabene, or equivalent). Customers do not need to manage this
        themselves.
      </p>
    ),
  },
  {
    id: "jurisdictions",
    heading: "Jurisdictions served",
    body: (
      <>
        <p>
          The Services are currently available to businesses incorporated in
          the United States, Canada, the EU/EEA, the United Kingdom, Nigeria,
          Kenya, South Africa, Singapore, the UAE, Mexico, and a growing list
          of additional jurisdictions. Payouts reach more than 170 countries.
        </p>
        <p>
          We do not currently support businesses or end-users in Cuba, Iran,
          North Korea, Syria, the Crimea/Donetsk/Luhansk regions of Ukraine,
          or other comprehensively sanctioned territories.
        </p>
      </>
    ),
  },
  {
    id: "reporting",
    heading: "Reporting & inquiries",
    body: (
      <p>
        Law-enforcement and regulatory inquiries should be directed to{" "}
        <a
          href="mailto:legal@useroutr.com"
          className="text-ink underline decoration-rule-2 decoration-from-font underline-offset-4 hover:text-ink"
        >
          legal@useroutr.com
        </a>
        . We respond to legally valid requests promptly and only disclose what
        is required by the request.
      </p>
    ),
  },
];

export default function CompliancePage() {
  return (
    <PageShell>
      <PageEnter>
        <LegalShell
          title={
            <>
              Compliance, in{" "}
              <span className="editorial-italic text-ink-2">plain</span> terms.
            </>
          }
          intro="Licensing, KYC and KYB, sanctions screening, AML monitoring, travel-rule support, and how we handle legal inquiries."
          lastUpdated="May 1, 2026"
          sections={sections}
        />
      </PageEnter>
    </PageShell>
  );
}
