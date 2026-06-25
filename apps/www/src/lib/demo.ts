/**
 * Mock async layer for the homepage demo widget.
 * When the real backend lands, swap the bodies of `runDemoRoute` and the
 * route-builder functions to hit /api/* — the components stay untouched.
 */

export type ReceiveMethod = {
  id: string;
  label: string;
  sublabel: string;
  /** BrandLogo id — looked up in BRAND_LOGOS. */
  brand: string;
  rate: number;
};

export const RECEIVE_METHODS: ReceiveMethod[] = [
  {
    id: "usdc-stellar",
    label: "USDC",
    sublabel: "Stellar · 1.00 USD",
    brand: "usdc",
    rate: 1,
  },
  {
    id: "xlm",
    label: "XLM",
    sublabel: "Stellar · 0.352 USD",
    brand: "xlm",
    rate: 0.3523,
  },
  {
    id: "eurc-stellar",
    label: "EURC",
    sublabel: "Stellar · 1.089 USD",
    brand: "eurc",
    rate: 1.0887,
  },
  {
    id: "ach",
    label: "Bank transfer",
    sublabel: "ACH · 1-2 business days",
    brand: "bank",
    rate: 1,
  },
];

export type SendDestination = {
  id: string;
  label: string;
  sublabel: string;
  brand: string;
};

export const SEND_DESTINATIONS: SendDestination[] = [
  {
    id: "stellar",
    label: "Stellar address",
    sublabel: "GA••• · USDC, XLM, EURC",
    brand: "stellar",
  },
  {
    id: "bank",
    label: "Bank account",
    sublabel: "ACH · SWIFT · SEPA",
    brand: "bank",
  },
  {
    id: "mobile",
    label: "Mobile money",
    sublabel: "MoneyGram · 174 countries",
    brand: "moneygram",
  },
  {
    id: "card",
    label: "Debit card",
    sublabel: "Visa Direct · Mastercard Send",
    brand: "visa",
  },
];

export type RouteStep = {
  id: string;
  label: string;
  durationMs: number;
};

export type RouteResult = {
  steps: RouteStep[];
  /** Short summary shown on the receipt, e.g. "USDC@Stellar → Acme treasury". */
  routeSummary: string;
  network: string;
  fee: string;
};

export function getReceiveRoute(methodId: string): RouteResult {
  if (methodId === "ach") {
    return {
      steps: [
        { id: "approve", label: "Authorizing ACH debit", durationMs: 900 },
        { id: "route", label: "Settling on-chain", durationMs: 1200 },
        { id: "done", label: "Funds available", durationMs: 600 },
      ],
      routeSummary: "Bank · ACH → Stellar treasury",
      network: "ACH + Stellar",
      fee: "$0.25",
    };
  }
  const method = RECEIVE_METHODS.find((m) => m.id === methodId);
  return {
    steps: [
      { id: "approve", label: "Approving payment", durationMs: 700 },
      { id: "route", label: "Routing through Stellar", durationMs: 1100 },
      { id: "done", label: "Settled to your treasury", durationMs: 500 },
    ],
    routeSummary: `${method?.label ?? "Token"}@Stellar → Acme treasury`,
    network: "Stellar mainnet",
    fee: "$0.0001",
  };
}

export function getSendRoute(destId: string): RouteResult {
  if (destId === "bank") {
    return {
      steps: [
        { id: "convert", label: "Converting to USD", durationMs: 800 },
        { id: "route", label: "Routing via Circle", durationMs: 1100 },
        { id: "deliver", label: "Delivered to bank", durationMs: 600 },
      ],
      routeSummary: "USDC@Stellar → Circle → Bank (ACH)",
      network: "Stellar + ACH",
      fee: "$0.50",
    };
  }
  if (destId === "mobile") {
    return {
      steps: [
        { id: "convert", label: "Converting to local currency", durationMs: 800 },
        { id: "route", label: "Routing via MoneyGram", durationMs: 1100 },
        { id: "deliver", label: "Delivered to recipient", durationMs: 600 },
      ],
      routeSummary: "USDC@Stellar → MoneyGram → Cash pickup",
      network: "Stellar + MoneyGram",
      fee: "1.2%",
    };
  }
  if (destId === "card") {
    return {
      steps: [
        { id: "convert", label: "Converting to USD", durationMs: 700 },
        { id: "route", label: "Visa Direct push", durationMs: 1200 },
        { id: "deliver", label: "Card credited", durationMs: 500 },
      ],
      routeSummary: "USDC@Stellar → Visa Direct → Card",
      network: "Stellar + Visa Direct",
      fee: "0.6%",
    };
  }
  return {
    steps: [
      { id: "submit", label: "Submitting to Stellar", durationMs: 700 },
      { id: "confirm", label: "Confirming on ledger", durationMs: 900 },
      { id: "done", label: "Delivered to wallet", durationMs: 500 },
    ],
    routeSummary: "USDC@Stellar → Recipient wallet",
    network: "Stellar mainnet",
    fee: "$0.0001",
  };
}

/**
 * Drive a route forward, invoking `onStep` as each step begins.
 * Replace the body with a streaming fetch when the API is live.
 */
export async function runDemoRoute(
  steps: RouteStep[],
  onStep: (idx: number) => void,
): Promise<void> {
  for (let i = 0; i < steps.length; i++) {
    onStep(i);
    await sleep(steps[i].durationMs);
  }
  // Final tick — mark all done
  onStep(steps.length);
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function formatUSD(amount: number) {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

export function convertFromUSD(usd: number, rate: number) {
  return usd / rate;
}
