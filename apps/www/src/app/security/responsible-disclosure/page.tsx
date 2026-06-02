import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/site/PageShell";
import { PageEnter } from "@/components/site/PageEnter";
import { LegalShell, type LegalSection } from "@/components/v2/LegalShell";

export const metadata: Metadata = {
  title: "Responsible disclosure — Useroutr",
  description:
    "Useroutr responsible disclosure policy for reporting security issues privately and in good faith.",
  alternates: { canonical: "/security/responsible-disclosure" },
};

const sections: LegalSection[] = [
  {
    id: "in-scope",
    heading: "In scope",
    body: (
      <p>
        In scope for responsible disclosure are useroutr.com, app.useroutr.com, api.useroutr.com, checkout.useroutr.com, docs.useroutr.com, all Useroutr-owned client SDKs, and the open-source contracts in this repository.
      </p>
    ),
  },
  {
    id: "out-of-scope",
    heading: "Out of scope",
    body: (
      <ul className="list-disc space-y-2 pl-5 marker:text-ink-4">
        <li>Third-party services we use — report those directly to the vendor.</li>
        <li>Denial-of-service by volume — we do not grade capacity-based attacks.</li>
        <li>DNS or TLS misconfigurations without proof of impact.</li>
        <li>Social engineering of staff or customers.</li>
      </ul>
    ),
  },
  {
    id: "how-to-report",
    heading: "How to report",
    body: (
      <p>
        Email <a
          href="mailto:security@useroutr.com"
          className="text-ink underline decoration-rule-2 decoration-from-font underline-offset-4 hover:text-ink"
        >
          security@useroutr.com
        </a> with a clear description, repro steps, impact assessment, and your preferred contact. Include the PGP key fingerprint or use our PGP key at <Link href="/security/pgp.txt" className="text-ink underline decoration-rule-2 decoration-from-font underline-offset-4 hover:text-ink">/security/pgp.txt</Link>.
      </p>
    ),
  },
  {
    id: "what-we-commit",
    heading: "What we commit",
    body: (
      <ul className="list-disc space-y-2 pl-5 marker:text-ink-4">
        <li>We acknowledge reports within 24 hours.</li>
        <li>We provide an initial assessment within 5 business days.</li>
        <li>Critical findings are fixed in production within 30 days and high findings within 60 days.</li>
        <li>We do not take legal action against good-faith research.</li>
      </ul>
    ),
  },
  {
    id: "safe-harbor",
    heading: "Safe harbor",
    body: (
      <p>
        We will not pursue legal action or law enforcement against researchers who act in good faith. Good faith means avoiding data destruction, not accessing more PII than necessary to prove the issue, and not disclosing publicly until we have shipped a fix.
      </p>
    ),
  },
  {
    id: "recognition",
    heading: "Recognition",
    body: (
      <p>
        Verified reports may be recognized in a public hall of fame at <Link href="/security/researchers" className="text-ink underline decoration-rule-2 decoration-from-font underline-offset-4 hover:text-ink">/security/researchers</Link>. Cash bounties start at $250 for low severity and can go up to $5,000 for critical issues, at our discretion.
      </p>
    ),
  },
];

export default function ResponsibleDisclosurePage() {
  return (
    <PageShell>
      <PageEnter>
        <LegalShell
          title={
            <>
              Responsible <span className="editorial-italic text-ink-2">disclosure</span>
            </>
          }
          intro="If you've found a security issue in Useroutr, please tell us privately before disclosing publicly. We'll respond fast, fix it, and credit you."
          lastUpdated="May 29, 2026"
          sections={sections}
        />
      </PageEnter>
    </PageShell>
  );
}
