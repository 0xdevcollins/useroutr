export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  author: string;
  category: string;
  readTime: string;
  canonicalPath: string;
  body: string[];
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "how-to-choose-a-stablecoin-payment-processor",
    title: "How to choose a stablecoin payment processor in 2026",
    excerpt:
      "A practical framework for fintech and treasury teams evaluating custody, settlement risk, pricing, and integration overhead.",
    publishedAt: "2026-05-29",
    author: "Mira Adeoye",
    category: "Strategy",
    readTime: "8 min read",
    canonicalPath: "/blog/how-to-choose-a-stablecoin-payment-processor",
    body: [
      "Most teams over-index on the demo and under-index on the settlement model. Ask where funds sit at every step and who controls the keys. If the answer includes pooled platform balances, model regulatory and counterparty risk before you model conversion rates.",
      "Second, evaluate integration shape. If payments, payouts, and reconciliation all require separate APIs or vendors, your effective implementation time triples. The right processor should collapse those flows into one ledger model and one webhook contract.",
      "Third, insist on pricing clarity. A low headline fee can hide markups on network fees, FX spread, and payout rails. You should be able to answer what a representative transaction costs end-to-end before signing.",
      "Finally, pressure-test operations: retries, idempotency, incident handling, and reporting exports. Growth rarely breaks because checkout looked bad. It breaks because finance cannot close, support cannot trace failures, and engineering cannot safely retry.",
    ],
  },
  {
    slug: "cctp-v2-explained-for-product-teams",
    title: "CCTP V2 explained for product teams",
    excerpt:
      "What burn-and-mint means in practice, why attestation latency matters, and how to design a customer-friendly payment state machine.",
    publishedAt: "2026-05-20",
    author: "Lukas Vogel",
    category: "Engineering",
    readTime: "6 min read",
    canonicalPath: "/blog/cctp-v2-explained-for-product-teams",
    body: [
      "CCTP V2 is not just a protocol detail. It directly shapes user experience. Your product needs clear states for lock, confirmation, attestation, destination mint, and settlement finality.",
      "The most important implementation detail is timeout handling. Attestation can be delayed by upstream conditions, so your UI and webhooks should distinguish delayed from failed rather than collapsing both into one error state.",
      "Design your state machine so support and finance can trace each phase without chain expertise. Human-readable statuses reduce ticket load and make reconciliation practical.",
      "When done correctly, the customer experience feels simple even though multiple chains and services are involved. Complexity belongs in infrastructure, not in customer messaging.",
    ],
  },
  {
    slug: "merchant-onboarding-kyb-without-funnel-dropoff",
    title: "Merchant KYB without funnel drop-off",
    excerpt:
      "How to keep onboarding conversion high while meeting compliance requirements for high-risk cross-border use cases.",
    publishedAt: "2026-05-10",
    author: "Priya Ravichandran",
    category: "Compliance",
    readTime: "7 min read",
    canonicalPath: "/blog/merchant-onboarding-kyb-without-funnel-dropoff",
    body: [
      "KYB friction usually comes from sequencing. Teams ask for everything on day one, even when risk is low at signup. A phased approach improves conversion while preserving control coverage.",
      "Collect core legal entity and ownership details early, then trigger enhanced requirements by risk signals such as geography, transaction size, and industry.",
      "Make requirements explicit with progress indicators and turnaround expectations. Uncertainty, not paperwork, is what causes most abandonment.",
      "Finally, centralize evidence and audit notes so support and compliance teams do not ask merchants for the same document twice.",
    ],
  },
  {
    slug: "from-swift-to-stablecoin-settlement-playbook",
    title: "From SWIFT to stablecoin settlement: a migration playbook",
    excerpt:
      "A phased rollout model for replacing expensive wire-heavy receivables with faster on-chain settlement.",
    publishedAt: "2026-04-28",
    author: "Daniel Otieno",
    category: "Operations",
    readTime: "9 min read",
    canonicalPath: "/blog/from-swift-to-stablecoin-settlement-playbook",
    body: [
      "Do not migrate every corridor at once. Start with one high-fee, high-delay lane where the business impact is obvious. Capture baseline DSO, fee, and failure metrics before rollout.",
      "Run parallel reconciliation for two close cycles. Finance confidence is the gating factor for expansion, not API readiness.",
      "Introduce payout rails after inflow is stable. Teams that change both collections and payouts in one phase usually lose observability and attribution.",
      "Treat migration as an operating model change: support scripts, incident runbooks, and monthly reporting all need to evolve with the rail change.",
    ],
  },
  {
    slug: "building-procurement-ready-payment-infrastructure",
    title: "Building procurement-ready payment infrastructure",
    excerpt:
      "The legal, security, and operational pages enterprise buyers expect before they agree to a pilot.",
    publishedAt: "2026-04-15",
    author: "Useroutr Editorial",
    category: "Company",
    readTime: "5 min read",
    canonicalPath: "/blog/building-procurement-ready-payment-infrastructure",
    body: [
      "Enterprise procurement is not blocked by feature gaps as often as by trust gaps. Buyers need clear legal terms, security posture, compliance statements, and support expectations before technical evaluation.",
      "Your marketing site should answer baseline diligence questions: data handling, disclosure channels, uptime commitments, and responsible disclosure policy.",
      "When these materials are missing, sales cycles slow and technical champions lose momentum internally. Shipping these pages is a growth feature, not documentation overhead.",
      "A good rule: if your team cannot answer common security and legal questions from a link in two clicks, procurement will stall.",
    ],
  },
].sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));

export function getBlogPost(slug: string): BlogPost | null {
  return BLOG_POSTS.find((post) => post.slug === slug) ?? null;
}
