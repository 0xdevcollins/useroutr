import type { Metadata } from "next";
import { PageShell } from "@/components/site/PageShell";
import { PageEnter } from "@/components/site/PageEnter";
import { LegalShell, type LegalSection } from "@/components/v2/LegalShell";

export const metadata: Metadata = {
  title: "Terms of Service — Useroutr",
  description:
    "The agreement between you and Useroutr Labs, Inc. governing your use of the Useroutr platform, APIs, and services.",
  alternates: { canonical: "/terms" },
};

const sections: LegalSection[] = [
  {
    id: "acceptance",
    heading: "Acceptance of these Terms",
    body: (
      <>
        <p>
          These Terms of Service (&ldquo;Terms&rdquo;) form a binding agreement
          between you (&ldquo;Customer&rdquo;, &ldquo;you&rdquo;) and Useroutr
          Labs, Inc. (&ldquo;Useroutr&rdquo;, &ldquo;we&rdquo;) governing your
          use of the Useroutr dashboard, APIs, SDKs, hosted checkout, and any
          related services (collectively, the &ldquo;Services&rdquo;).
        </p>
        <p>
          By creating an account, integrating our APIs, or using any portion of
          the Services, you agree to be bound by these Terms. If you accept
          these Terms on behalf of an organization, you represent that you have
          authority to do so.
        </p>
      </>
    ),
  },
  {
    id: "accounts",
    heading: "Accounts & access",
    body: (
      <>
        <p>
          You are responsible for maintaining the confidentiality of your API
          keys, dashboard credentials, and any signing material we issue. Treat
          API keys like passwords — never embed them in client-side code,
          mobile bundles, or public repositories.
        </p>
        <p>
          You agree to provide accurate and current account information,
          including business name, legal entity, beneficial owners, and contact
          details, and to update them when they change. We may suspend or
          terminate access where information is materially inaccurate.
        </p>
      </>
    ),
  },
  {
    id: "acceptable-use",
    heading: "Acceptable use",
    body: (
      <>
        <p>
          You may use the Services only for lawful business purposes and only
          in jurisdictions where they are available. You agree not to use the
          Services in connection with prohibited activities, which include but
          are not limited to: regulated gambling without proper licensing,
          unlicensed money transmission, distribution of controlled substances,
          weapons trafficking, child exploitation material, or any activity
          violating applicable sanctions.
        </p>
        <p>
          We may, at our discretion, refuse, hold, reverse, or unwind any
          transaction we reasonably believe violates this Section or applicable
          law.
        </p>
      </>
    ),
  },
  {
    id: "fees",
    heading: "Fees & settlement",
    body: (
      <>
        <p>
          Fees for the Services are described on our pricing page and in any
          order form or addendum you sign. Transaction fees are calculated and
          applied at the time of settlement, in the same currency as the
          underlying payment unless otherwise specified.
        </p>
        <p>
          Network fees (Stellar, Visa Direct, ACH, SWIFT, MoneyGram, etc.) are
          passed through at cost and are clearly itemized in your settlement
          reports. We do not mark up network fees.
        </p>
      </>
    ),
  },
  {
    id: "funds-and-custody",
    heading: "Funds, managed wallets, and self-custody",
    body: (
      <>
        <p>
          Settlement happens on-chain. Funds move directly through the
          underlying networks from the payer to your designated settlement
          destination — they do not sit on a Useroutr balance sheet.
        </p>
        <p>
          By default, Useroutr provisions and manages a Stellar settlement
          wallet on your behalf so you can accept payments from day one. The
          keys for that managed wallet are held by Useroutr under encryption
          (KEK in a managed secrets store) and used solely to forward funds
          to you. You can withdraw the balance to a wallet you control at any
          time, and you can upgrade to a self-custody settlement wallet
          (passkey-derived or bring-your-own) whenever you choose.
        </p>
        <p>
          When you operate a self-custody settlement wallet, you are solely
          responsible for its custody and security. We strongly recommend
          hardware security modules or multi-party computation for any wallet
          handling material balances.
        </p>
      </>
    ),
  },
  {
    id: "compliance",
    heading: "Compliance obligations",
    body: (
      <>
        <p>
          Depending on your jurisdiction and how you use the Services, you may
          be subject to anti-money-laundering, know-your-customer,
          counter-terrorist-financing, tax-reporting, sanctions, consumer
          protection, and other laws. You are responsible for your own
          compliance program.
        </p>
        <p>
          Useroutr provides tools — KYB onboarding, sanctions screening,
          transaction monitoring hooks, audit logs — to help you discharge
          those obligations, but using these tools does not transfer the
          underlying legal duty to us.
        </p>
      </>
    ),
  },
  {
    id: "ip",
    heading: "Intellectual property",
    body: (
      <>
        <p>
          The Useroutr name, logos, dashboard, APIs, SDKs, documentation, and
          all related code, trademarks, and content remain our property or that
          of our licensors. We grant you a limited, non-exclusive,
          non-transferable license to use them solely as needed to access the
          Services.
        </p>
        <p>
          You retain all rights to your own content, including any data you
          upload, customer records, transaction history, and code you write
          against our APIs.
        </p>
      </>
    ),
  },
  {
    id: "warranties",
    heading: "Disclaimers",
    body: (
      <p>
        The Services are provided &ldquo;as is&rdquo; and &ldquo;as
        available.&rdquo; Useroutr disclaims, to the maximum extent permitted by
        law, all warranties — express or implied — including merchantability,
        fitness for a particular purpose, non-infringement, accuracy, and any
        warranty arising from course of dealing or trade usage.
      </p>
    ),
  },
  {
    id: "liability",
    heading: "Limitation of liability",
    body: (
      <>
        <p>
          To the maximum extent permitted by law, neither party will be liable
          for any indirect, incidental, special, consequential, or exemplary
          damages, or for any loss of profits, revenues, data, or goodwill.
        </p>
        <p>
          Useroutr&rsquo;s total aggregate liability arising out of or relating
          to these Terms will not exceed the greater of (a) the fees paid to
          Useroutr in the twelve months preceding the event giving rise to
          liability and (b) one thousand U.S. dollars (USD&nbsp;1,000).
        </p>
      </>
    ),
  },
  {
    id: "termination",
    heading: "Termination & disputes",
    body: (
      <>
        <p>
          Either party may terminate these Terms at any time, with or without
          cause, by providing written notice. Upon termination, your right to
          access the Services ends, but obligations that by their nature
          survive (fees owed, confidentiality, indemnity, limitations on
          liability, dispute resolution) will continue.
        </p>
        <p>
          These Terms are governed by the laws of the State of Delaware,
          without regard to its conflict-of-laws principles. Any dispute will
          be resolved through binding arbitration in San Francisco, California,
          under the Commercial Arbitration Rules of the American Arbitration
          Association.
        </p>
      </>
    ),
  },
];

export default function TermsPage() {
  return (
    <PageShell>
      <PageEnter>
        <LegalShell
          title={
            <>
              Terms of{" "}
              <span className="editorial-italic text-ink-2">Service</span>
            </>
          }
          intro="The agreement between you and Useroutr Labs, Inc. governing your use of the Useroutr platform, APIs, and services."
          lastUpdated="May 1, 2026"
          sections={sections}
        />
      </PageEnter>
    </PageShell>
  );
}
