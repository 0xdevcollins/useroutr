"use client";

import { useState, use, useMemo, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { usePaymentLink } from "@/hooks/usePaymentLink";
import { api, ApiError } from "@/lib/api";
import { MerchantBranding } from "@/components/MerchantBranding";
import { LinkCard } from "@/components/LinkCard";
import { LinkError } from "@/components/LinkError";
import { TrustBadges } from "@/components/TrustBadges";

/**
 * Customer-facing payment-link page. Mounted at
 * `pay.useroutr.com/l/{shortCode}` (the `l/` segment preserves room for
 * other dynamic routes — invoice, payment — at sibling paths).
 *
 * Resolves the link via the public API endpoint (`GET /v1/links/:shortCode`),
 * which is unauthenticated and returns only customer-safe metadata. The
 * API enforces inactive/expired/single-use-exhausted as a 410 response —
 * this page just routes the status code to the right error screen.
 *
 * Brand color (`merchantBrandColor`) is applied as a CSS variable override
 * on a single wrapper so the existing `--primary` token cascades — every
 * `bg-primary` / `text-primary` consumer inside the wrapper picks up the
 * merchant's color without component-level prop drilling.
 */
export default function PaymentLinkPage({
  params,
}: {
  params: Promise<{ shortCode: string }>;
}) {
  const { shortCode } = use(params);
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: link, isLoading, error } = usePaymentLink(shortCode);

  // Compute the brand-color CSS-variable style once per render. Memoized so
  // React doesn't tear down + remount the wrapper on every state change.
  const brandStyle = useMemo<CSSProperties | undefined>(() => {
    const color = link?.merchantBrandColor;
    if (!color) return undefined;
    return { ["--primary" as string]: color } as CSSProperties;
  }, [link?.merchantBrandColor]);

  const handleSubmit = async (amount?: number) => {
    if (!link) return;
    setIsSubmitting(true);
    try {
      // Public, unauthenticated endpoint — the shortCode is the credential.
      // The API resolves the link, atomically marks it used, and creates a
      // pre-quote Payment row. We then navigate the customer to the method
      // picker at `/{paymentId}`.
      const payment = await api.post<{ id: string }>(
        `/checkout/from-link/${shortCode}`,
        { amount },
      );
      router.push(`/${payment.id}`);
    } catch (err) {
      console.error("Failed to create payment:", err);
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen justify-center bg-muted/30 px-4 py-8 sm:px-8">
        <div className="w-full max-w-[460px] space-y-6">
          <div className="text-center">
            <div className="mx-auto h-10 w-10 skeleton rounded-lg" />
            <div className="mx-auto mt-2 h-4 w-32 skeleton" />
          </div>
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="space-y-4">
              <div>
                <div className="h-5 w-40 skeleton" />
                <div className="mt-1 h-4 w-24 skeleton" />
              </div>
              <div className="border-t border-border pt-4">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Amount</span>
                  <span className="skeleton h-6 w-24" />
                </div>
              </div>
              <button
                disabled
                className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground opacity-50"
              >
                Loading...
              </button>
            </div>
          </div>
          <TrustBadges />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <LinkError
        type={mapErrorToType(error)}
        expiresAt={link?.expiresAt ?? undefined}
      />
    );
  }

  if (!link) {
    // useQuery finished with no data and no error — shouldn't happen with
    // `retry: false`, but render the generic not-found rather than crash.
    return <LinkError type="not-found" />;
  }

  return (
    <div
      className="flex min-h-screen justify-center bg-muted/30 px-4 py-8 sm:px-8"
      style={brandStyle}
    >
      <div className="w-full max-w-[460px] space-y-6">
        <MerchantBranding
          merchantName={link.merchantName}
          merchantCompanyName={link.merchantCompanyName}
          merchantLogo={link.merchantLogo}
        />

        <LinkCard
          link={link}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />

        <TrustBadges />
      </div>
    </div>
  );
}

/**
 * Translate the API's HTTP status (404 vs 410) plus the 410 message body
 * into the right `LinkError` variant. Avoids re-checking link state on
 * the client now that the public endpoint is authoritative.
 */
function mapErrorToType(
  error: unknown,
): "not-found" | "expired" | "redeemed" | "inactive" {
  if (error instanceof ApiError) {
    if (error.status === 404) return "not-found";
    if (error.status === 410) {
      const msg = error.message.toLowerCase();
      if (msg.includes("expired")) return "expired";
      if (msg.includes("already been used")) return "redeemed";
      if (msg.includes("no longer active")) return "inactive";
      // Unknown 410 reason — surface as inactive (most generic).
      return "inactive";
    }
  }
  return "not-found";
}
