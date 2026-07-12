"use client";

import { useEffect, useState } from "react";
import { Clock } from "@phosphor-icons/react/dist/ssr";
import { usePayment } from "@/hooks/usePayment";
import { MerchantBranding } from "@/components/MerchantBranding";
import { TrustBadges } from "@/components/TrustBadges";

interface ExpiredPageClientProps {
  params: Promise<{ paymentId: string }>;
}

export function ExpiredPageClient({ params }: ExpiredPageClientProps) {
  const [paymentId, setPaymentId] = useState<string>("");
  const { data: payment, isLoading } = usePayment(paymentId);

  // Unwrap params
  useEffect(() => {
    params.then((p) => setPaymentId(p.paymentId));
  }, [params]);

  const merchantName = payment?.merchant?.name || "Merchant";
  const merchantLogo = payment?.merchant?.logo;
  const redirectUrl = (payment?.metadata as { return_url?: string } | undefined)
    ?.return_url;

  return (
    <div className="flex min-h-screen justify-center bg-muted/30 px-4 py-8 sm:px-8">
      <div className="w-full max-w-[460px] space-y-6">
        <MerchantBranding
          merchantName={merchantName}
          merchantLogo={merchantLogo}
        />

        <div className="rounded-xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber/10">
            <Clock size={40} weight="fill" className="text-amber" />
          </div>
          <h2 className="mt-4 font-display text-lg font-semibold text-foreground">
            Session expired
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your payment session or quote has expired. Please request a new
            payment link from the merchant to continue.
          </p>

          <div className="mt-6 space-y-2">
            <button
              onClick={() => {
                window.open("https://support.example.com", "_blank");
              }}
              className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              Contact support
            </button>
            {redirectUrl && (
              <button
                onClick={() => {
                  window.location.href = redirectUrl;
                }}
                className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:brightness-110"
              >
                Return to merchant
              </button>
            )}
          </div>
        </div>

        <TrustBadges />
      </div>
    </div>
  );
}