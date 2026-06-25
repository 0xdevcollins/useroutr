import type { Metadata } from "next";
import { PageShell } from "@/components/site/PageShell";
import { PageEnter } from "@/components/site/PageEnter";
import { LegalShell, type LegalSection } from "@/components/v2/LegalShell";

export const metadata: Metadata = {
  title: "Security — Useroutr",
  description:
    "How Useroutr secures its payment infrastructure: architecture, encryption, key management, access controls, audits, and incident response.",
  alternates: { canonical: "/security" },
};

const sections: LegalSection[] = [
  {
    id: "architecture",
    heading: "On-chain settlement, managed keys by default",
    body: (
      <>
        <p>
          Settlement happens on-chain. Payments and payouts move directly
          through the underlying networks (Stellar, Visa Direct, ACH,
          MoneyGram, etc.) from payer to your settlement destination — the
          funds never sit on a Useroutr balance sheet.
        </p>
        <p>
          By default, Useroutr provisions and manages a Stellar settlement
          wallet on your behalf so you can accept payments from day one. The
          private key for that wallet is encrypted at rest under a KEK held
          in a managed secrets store, used only to forward funds to you. You
          can withdraw the balance to a wallet you control at any time, and
          you can upgrade to a self-custody settlement wallet (passkey or
          bring-your-own) whenever you choose.
        </p>
        <p>
          Funds and payouts still move directly via the underlying networks
          (Stellar, Visa Direct, ACH, MoneyGram, etc.) — Useroutr is the
          orchestrator, not the destination.
          Our infrastructure routes, observes, and reconciles — it does not
          hold balances.
        </p>
        <p>
          This architecture reduces the blast radius of any compromise:
          there&rsquo;s no honey pot of customer funds at Useroutr to steal.
        </p>
      </>
    ),
  },
  {
    id: "encryption",
    heading: "Encryption in transit & at rest",
    body: (
      <ul className="list-disc space-y-2 pl-5 marker:text-ink-4">
        <li>
          All traffic between your systems and Useroutr is protected with
          TLS&nbsp;1.3 and modern cipher suites. HTTP-only endpoints are
          rejected.
        </li>
        <li>
          Data at rest in our primary databases and object storage is encrypted
          with AES-256, with keys managed in AWS KMS and rotated annually.
        </li>
        <li>
          Sensitive fields (API secrets, signing keys, KYB documents) are
          additionally encrypted at the application layer with envelope
          encryption.
        </li>
      </ul>
    ),
  },
  {
    id: "access",
    heading: "Access controls",
    body: (
      <>
        <p>
          Engineer access to production systems is granted on a least-privilege
          basis, requires hardware-key MFA, and is audited via SSH/console
          session logs. Production secrets are never stored on developer
          laptops.
        </p>
        <p>
          Internal access changes whenever an employee&rsquo;s role changes or
          they leave the company. Quarterly access reviews are run by our
          security team and signed off by the relevant manager.
        </p>
      </>
    ),
  },
  {
    id: "audits",
    heading: "Audits & certifications",
    body: (
      <>
        <p>
          Useroutr is currently completing its SOC&nbsp;2 Type&nbsp;II audit.
          Until the report is available, customers under NDA can request the
          observation period and any control summaries from our security team.
        </p>
        <p>
          Annual third-party penetration tests of our application and
          infrastructure are conducted by an independent firm. Executive
          summaries are available on request.
        </p>
      </>
    ),
  },
  {
    id: "infra",
    heading: "Network & infrastructure",
    body: (
      <>
        <p>
          The Useroutr platform runs on AWS in geographically separated regions
          with multi-AZ failover for stateful services. Traffic is fronted by
          a WAF that rate-limits and filters common attack patterns.
        </p>
        <p>
          Background jobs, webhook delivery, and reconciliation run in
          private subnets without inbound public access. Egress is restricted
          to allow-listed payment networks and core service dependencies.
        </p>
      </>
    ),
  },
  {
    id: "vuln-disclosure",
    heading: "Vulnerability disclosure",
    body: (
      <>
        <p>
          We welcome reports from independent researchers. If you believe
          you&rsquo;ve found a vulnerability in the Useroutr platform, email{" "}
          <a
            href="mailto:security@useroutr.com"
            className="text-ink underline decoration-rule-2 decoration-from-font underline-offset-4 hover:text-ink"
          >
            security@useroutr.com
          </a>{" "}
          with the details. We will acknowledge within one business day and
          work with you in good faith to triage and remediate.
        </p>
        <p>
          We do not currently operate a paid bug bounty program but we
          maintain a public hall of fame for verified reports.
        </p>
      </>
    ),
  },
  {
    id: "incident",
    heading: "Incident response",
    body: (
      <p>
        Useroutr maintains a documented incident-response plan covering
        detection, containment, eradication, recovery, and post-incident
        review. We will notify affected customers without undue delay when a
        confirmed incident materially impacts the security or availability of
        the Services.
      </p>
    ),
  },
  {
    id: "shared",
    heading: "Customer responsibilities",
    body: (
      <ul className="list-disc space-y-2 pl-5 marker:text-ink-4">
        <li>Treat API keys like passwords. Never embed them client-side.</li>
        <li>Rotate keys regularly and remove access when team members leave.</li>
        <li>
          Verify webhook signatures using the secret in your dashboard before
          acting on any event payload.
        </li>
        <li>
          Use hardware security or MPC for any wallet you connect as a
          settlement destination.
        </li>
        <li>Enable MFA for every user in your Useroutr dashboard.</li>
      </ul>
    ),
  },
];

export default function SecurityPage() {
  return (
    <PageShell>
      <PageEnter>
        <LegalShell
          title={
            <>
              Security at{" "}
              <span className="editorial-italic text-ink-2">Useroutr</span>
            </>
          }
          intro="How we protect the payment infrastructure you depend on — architecture, controls, audits, and the responsibilities we share with you."
          lastUpdated="May 1, 2026"
          sections={sections}
        />
      </PageEnter>
    </PageShell>
  );
}
