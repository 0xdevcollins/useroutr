import type { Metadata } from "next";
import { PageShell } from "@/components/site/PageShell";
import { PageEnter } from "@/components/site/PageEnter";
import { LegalShell, type LegalSection } from "@/components/v2/LegalShell";

export const metadata: Metadata = {
  title: "Cookie Policy — Useroutr",
  description:
    "How Useroutr uses cookies and tracking technologies, and how you can manage them.",
  alternates: { canonical: "/cookies" },
};

const sections: LegalSection[] = [
  {
    id: "necessary-cookies",
    heading: "Necessary cookies",
    body: (
      <p>
        We use necessary cookies for authentication, session state, CSRF protection, and language preference. These cookies are always on and cannot be disabled because the dashboard will not work without them.
      </p>
    ),
  },
  {
    id: "analytics-cookies",
    heading: "Analytics cookies",
    body: (
      <p>
        We use a limited analytics cookie set for page views, session tracking, and event measurement. These cookies are enabled unless you opt out. We use this data to find broken flows, dead links, and to improve the product.
      </p>
    ),
  },
  {
    id: "third-party-trackers",
    heading: "No third-party trackers",
    body: (
      <p>
        We do not use third-party advertising or tracking pixels. No Facebook Pixel, no Google Ads remarketing, no TikTok, and no LinkedIn Insight Tag are loaded on useroutr.com.
      </p>
    ),
  },
  {
    id: "opt-out",
    heading: "Opt-out",
    body: (
      <p>
        You can opt out at any time from the dashboard footer settings, by enabling Do-Not-Track in your browser, or by blocking third-party cookies in your browser. We honor Do-Not-Track requests and we do not use tracking cookies to build profiles or serve ads.
      </p>
    ),
  },
];

export default function CookiePolicyPage() {
  return (
    <PageShell>
      <PageEnter>
        <LegalShell
          title={
            <>
              How we use <span className="editorial-italic text-ink-2">cookies</span>
            </>
          }
          intro="We use cookies sparingly. Almost everything on useroutr.com works without them; we only set the ones we need to keep you signed in and to measure whether the site is actually working."
          lastUpdated="May 29, 2026"
          sections={sections}
        />
      </PageEnter>
    </PageShell>
  );
}
