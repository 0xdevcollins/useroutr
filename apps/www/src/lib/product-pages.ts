export interface ProductPage {
  slug: string;
  name: string;
  category: string;
  summary: string;
  description: string;
  bullets: string[];
  primaryCta: { label: string; href: string };
  secondaryCta: { label: string; href: string };
}

export const PRODUCT_PAGES: ProductPage[] = [
  {
    slug: "hosted-checkout",
    name: "Hosted Checkout",
    category: "Payments",
    summary:
      "Launch a branded checkout that accepts card, bank, crypto, and mobile money in one flow.",
    description:
      "Drop in a single hosted checkout URL and start accepting global payments without rebuilding your frontend. Useroutr handles quote lock, rail selection, settlement routing, and confirmation updates with typed webhook events.",
    bullets: [
      "Drop-in page with your logo and brand color",
      "Method tabs for card, bank, crypto, and mobile money",
      "30-second quote lock for volatile pairs",
      "Webhook events for each state transition",
    ],
    primaryCta: { label: "Start with checkout", href: "https://docs.useroutr.com" },
    secondaryCta: { label: "Talk to sales", href: "/contact" },
  },
  {
    slug: "payment-links",
    name: "Payment Links",
    category: "No-code Collection",
    summary:
      "Create links in seconds for one-off payments, deposits, and recurring collection flows.",
    description:
      "Generate shareable links from API or dashboard and let customers pay without a custom integration. Open-amount and fixed-amount links both route through the same reconciliation and reporting model.",
    bullets: [
      "Single-use or reusable links",
      "Open amount and fixed amount support",
      "Expiration, usage tracking, and QR code support",
      "Automatic ledger mapping in exports",
    ],
    primaryCta: { label: "Read payment links docs", href: "https://docs.useroutr.com" },
    secondaryCta: { label: "See pricing", href: "/pricing" },
  },
  {
    slug: "invoicing",
    name: "Invoicing",
    category: "AR Automation",
    summary:
      "Issue invoices with embedded checkout and settle cross-border receivables faster.",
    description:
      "Build and send professional invoices with line items, taxes, reminders, and partial payments. Every invoice maps to a payment lifecycle so finance can reconcile by customer, currency, and destination rail.",
    bullets: [
      "Hosted invoice pages with branded checkout",
      "Partial payments and automatic status transitions",
      "Reminder schedules and audit trails",
      "CSV and JSON export for month-end close",
    ],
    primaryCta: { label: "Explore invoicing API", href: "https://docs.useroutr.com" },
    secondaryCta: { label: "Read customer stories", href: "/customers" },
  },
  {
    slug: "global-payouts",
    name: "Global Payouts",
    category: "Disbursements",
    summary:
      "Send payouts to bank accounts, cards, mobile wallets, or crypto destinations in 174 countries.",
    description:
      "Use bulk payouts with per-recipient outcomes and idempotent retries. Route each recipient to the best rail while preserving one reconciliation surface for treasury and finance teams.",
    bullets: [
      "Up to 1,000 recipients per bulk call",
      "Per-recipient status and retry controls",
      "Bank, mobile money, card, and crypto destinations",
      "Supports treasury-grade reconciliation",
    ],
    primaryCta: { label: "Open payouts reference", href: "https://docs.useroutr.com/payouts" },
    secondaryCta: { label: "Contact partnerships", href: "/contact" },
  },
];

export const LEGACY_PRODUCT_REDIRECTS: Record<string, string> = {
  gateway: "hosted-checkout",
  payouts: "global-payouts",
  invoicing: "invoicing",
};

export function getProductBySlug(slug: string): ProductPage | null {
  const normalized = LEGACY_PRODUCT_REDIRECTS[slug] ?? slug;
  return PRODUCT_PAGES.find((p) => p.slug === normalized) ?? null;
}
