import {
  Banknote,
  Building2,
  CreditCard,
  Landmark,
  Smartphone,
  Webhook,
  type LucideIcon,
} from "lucide-react";

/**
 * Single source of truth for every brand mark rendered across the site —
 * crypto assets, card networks, bank rails, mobile money, and integrations.
 *
 * Resolution order in <BrandLogo>:
 *   1. `src`   — official SVG file under /public (preferred for real brands)
 *   2. `icon`  — Lucide icon component (preferred for generic categories)
 *   3. `glyph` — colored badge fallback when nothing else fits
 *
 * To add a new brand: drop the SVG under /public/<category>-logo/ and add
 * an entry with `src`. To add a new generic category (e.g. SEPA, IBAN),
 * use `icon` + `tone`. Glyph fallback is the last resort.
 */

export type BrandCategory =
  | "crypto"
  | "card"
  | "bank"
  | "mobile"
  | "integration";

export interface BrandLogoEntry {
  /** Stable id — what you pass to <BrandLogo id="..." />. Lowercase, dash-free. */
  id: string;
  /** Display label shown when `withLabel` is true. */
  label: string;
  category: BrandCategory;
  /** Path to the icon-style SVG under /public. Preferred for badges. */
  src?: string;
  /**
   * Path to a wordmark SVG (logo + brand name as a horizontal lockup).
   * When set, surfaces that opt in (e.g. TrustStrip marquee) render this
   * alone — no separate text label — for a cleaner brand presentation.
   */
  srcLockup?: string;
  /** Lucide icon component — used when no src, for generic categories. */
  icon?: LucideIcon;
  /** Single character(s) rendered inside a colored badge — last-resort fallback. */
  glyph?: string;
  /** Tailwind classes for the badge background + text color (icon/glyph cases). */
  tone?: string;
}

export const BRAND_LOGOS: Record<string, BrandLogoEntry> = {
  /* ----------------------------- Crypto / chains ----------------------------- */
  usdc: {
    id: "usdc",
    label: "USDC",
    category: "crypto",
    src: "/currency-logo/usd-coin-usdc-logo.svg",
  },
  usdt: {
    id: "usdt",
    label: "USDT",
    category: "crypto",
    src: "/currency-logo/tether-usdt-logo.svg",
  },
  xlm: {
    id: "xlm",
    label: "XLM",
    category: "crypto",
    src: "/currency-logo/stellar-xlm-logo.svg",
  },
  stellar: {
    id: "stellar",
    label: "Stellar",
    category: "crypto",
    src: "/currency-logo/stellar-xlm-logo.svg",
    /** Official Stellar wordmark from the Foundation press kit. */
    srcLockup: "/brand-mark/stellar.png",
  },
  "stellar-foundation": {
    id: "stellar-foundation",
    label: "Stellar Development Foundation",
    category: "integration",
    /** Official SDF wordmark — useful on the /about investor strip. */
    src: "/brand-mark/stellar-foundation.svg",
    srcLockup: "/brand-mark/stellar-foundation.svg",
  },
  eth: {
    id: "eth",
    label: "Ethereum",
    category: "crypto",
    src: "/currency-logo/ethereum-eth-logo.svg",
  },
  sol: {
    id: "sol",
    label: "Solana",
    category: "crypto",
    src: "/currency-logo/solana-sol-logo.svg",
  },
  op: {
    id: "op",
    label: "Optimism",
    category: "crypto",
    src: "/currency-logo/optimism-ethereum-op-logo.svg",
  },
  polygon: {
    id: "polygon",
    label: "Polygon",
    category: "crypto",
    src: "/currency-logo/polygon.svg",
  },

  /* No-SVG-yet crypto — keep as styled fallbacks until we have proper marks */
  eurc: {
    id: "eurc",
    label: "EURC",
    category: "crypto",
    glyph: "€",
    tone: "bg-[#3b5af1] text-white",
  },
  soroban: {
    id: "soroban",
    label: "Soroban",
    category: "crypto",
    src: "/currency-logo/soroban.svg",
  },
  circle: {
    id: "circle",
    label: "Circle",
    category: "crypto",
    glyph: "C",
    tone: "bg-[#0fbf95] text-white",
  },

  /* ------------------------------ Card networks ------------------------------ */
  visa: {
    id: "visa",
    label: "Visa",
    category: "card",
    src: "/payment-logo/visa.svg",
  },
  mastercard: {
    id: "mastercard",
    label: "Mastercard",
    category: "card",
    src: "/payment-logo/mastercard.svg",
  },
  amex: {
    id: "amex",
    label: "Amex",
    category: "card",
    src: "/payment-logo/amex.svg",
  },
  card: {
    /* Generic "debit card" — used in DemoWidget "Deliver as" picker */
    id: "card",
    label: "Debit card",
    category: "card",
    icon: CreditCard,
    tone: "bg-ink text-bg",
  },

  /* ------------------------------- Bank rails -------------------------------- */
  bank: {
    id: "bank",
    label: "Bank",
    category: "bank",
    icon: Landmark,
    tone: "bg-ink text-bg",
  },
  ach: {
    id: "ach",
    label: "ACH",
    category: "bank",
    icon: Banknote,
    tone: "bg-bg-soft text-ink border border-rule",
  },
  swift: {
    id: "swift",
    label: "SWIFT",
    category: "bank",
    icon: Building2,
    tone: "bg-bg-soft text-ink border border-rule",
  },
  sepa: {
    id: "sepa",
    label: "SEPA",
    category: "bank",
    icon: Building2,
    tone: "bg-bg-soft text-ink border border-rule",
  },

  /* -------------------------- Mobile money / global -------------------------- */
  moneygram: {
    id: "moneygram",
    label: "MoneyGram",
    category: "mobile",
    src: "/payment-logo/moneygram.svg",
  },
  mpesa: {
    id: "mpesa",
    label: "M-Pesa",
    category: "mobile",
    icon: Smartphone,
    tone: "bg-[#1a8540] text-white",
  },
  wise: {
    id: "wise",
    label: "Wise",
    category: "mobile",
    src: "/payment-logo/wise.svg",
    srcLockup: "/brand-mark/wise.svg",
  },
  mobile: {
    /* Generic mobile money */
    id: "mobile",
    label: "Mobile money",
    category: "mobile",
    icon: Smartphone,
    tone: "bg-accent text-ink",
  },

  /* ----------------------------- Integrations -------------------------------- */
  stripe: {
    id: "stripe",
    label: "Stripe",
    category: "integration",
    src: "/integration-logo/stripe.svg",
    srcLockup: "/brand-mark/stripe.svg",
  },
  "stripe-treasury": {
    id: "stripe-treasury",
    label: "Stripe Treasury",
    category: "integration",
    src: "/integration-logo/stripe.svg",
    srcLockup: "/brand-mark/stripe.svg",
  },
  quickbooks: {
    id: "quickbooks",
    label: "QuickBooks",
    category: "integration",
    src: "/integration-logo/quickbooks.svg",
  },
  xero: {
    id: "xero",
    label: "Xero",
    category: "integration",
    src: "/integration-logo/xero.svg",
    srcLockup: "/brand-mark/xero.svg",
  },
  netsuite: {
    id: "netsuite",
    label: "NetSuite",
    category: "integration",
    glyph: "N",
    tone: "bg-ink text-bg",
  },
  zapier: {
    id: "zapier",
    label: "Zapier",
    category: "integration",
    src: "/integration-logo/zapier.svg",
    srcLockup: "/brand-mark/zapier.svg",
  },
  slack: {
    id: "slack",
    label: "Slack",
    category: "integration",
    src: "/integration-logo/slack.svg",
    srcLockup: "/brand-mark/slack.svg",
  },
  notion: {
    id: "notion",
    label: "Notion",
    category: "integration",
    src: "/integration-logo/notion.svg",
  },
  webhooks: {
    id: "webhooks",
    label: "Webhooks",
    category: "integration",
    icon: Webhook,
    tone: "bg-bg-soft text-ink border border-rule",
  },
  github: {
    id: "github",
    label: "GitHub",
    category: "integration",
    src: "/integration-logo/github.svg",
  },
  linkedin: {
    id: "linkedin",
    label: "LinkedIn",
    category: "integration",
    src: "/integration-logo/linkedin.svg",
  },
  x: {
    id: "x",
    label: "X",
    category: "integration",
    src: "/integration-logo/x.svg",
  },
};

/** Helpful for filtered selectors (e.g. "all integrations"). */
export function listByCategory(category: BrandCategory): BrandLogoEntry[] {
  return Object.values(BRAND_LOGOS).filter((b) => b.category === category);
}
