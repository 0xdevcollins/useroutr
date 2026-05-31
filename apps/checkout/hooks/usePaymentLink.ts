import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

/**
 * Shape returned by the API's public link resolver — `GET /v1/links/:shortCode`.
 * The endpoint is unauthenticated and exposes only customer-safe metadata
 * (nothing about the merchant beyond display name + branding, no internal
 * IDs, no settlement details). See `apps/api/src/modules/links/public-links.controller.ts`.
 */
export interface PaymentLink {
  /** Prefixed cuid, e.g. `lnk_clt1g8z...`. Used by the page when creating a payment. */
  id: string;
  /** Fixed-price links have `amount` set; open-amount links have `null`. */
  amount: number | null;
  /** Display currency for the amount, e.g. "USD". */
  currency: string;
  /** Merchant-supplied description; falls back to merchant name in UI. */
  description: string | null;
  /** True when only the first payment may consume the link. */
  singleUse: boolean;
  /** ISO 8601 expiry timestamp or null when the link doesn't expire. */
  expiresAt: string | null;
  /** Customer-safe merchant display name. Always present. */
  merchantName: string;
  /** Optional public-facing brand name (preferred over `merchantName`). */
  merchantCompanyName: string | null;
  /** Square logo URL for the checkout header. */
  merchantLogo: string | null;
  /** Hex string (e.g. "#ff5b1f") applied to CTA + accents. */
  merchantBrandColor: string | null;
}

/**
 * Resolve a payment link by short code. The hook deliberately doesn't try
 * to interpret error states — it lets `ApiError.status` bubble up so the
 * page can map 404 → "not found" and 410 → "no longer active / expired /
 * already used" with full fidelity, instead of inferring from flags that
 * the public endpoint no longer returns.
 */
export function usePaymentLink(shortCode: string) {
  return useQuery<PaymentLink>({
    queryKey: ["payment-link", shortCode],
    queryFn: () => api.get(`/links/${shortCode}`),
    enabled: !!shortCode,
    retry: false,
    // The link is stable for a session — no need to refetch on focus/reconnect.
    staleTime: Infinity,
  });
}
