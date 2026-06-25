"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { usePayment } from "@/hooks/usePayment";
import { MerchantBranding } from "@/components/MerchantBranding";
import { TrustBadges } from "@/components/TrustBadges";
import { SuccessCard } from "@/components/SuccessCArd";
import { RedirectCountdown } from "@/components/RedirectCountdown";

interface SuccessPageClientProps {
  params: Promise<{ paymentId: string }>;
}

export function SuccessPageClient({ params }: SuccessPageClientProps) {
  const [paymentId, setPaymentId] = useState<string>("");
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const { data: payment, isLoading } = usePayment(paymentId);

  // Unwrap params
  useEffect(() => {
    params.then((p) => setPaymentId(p.paymentId));
  }, [params]);

  // Set mounted after hydration to prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || isLoading) {
    return (
      <div className="flex min-h-screen justify-center bg-muted/30 px-4 py-8 sm:px-8">
        <div className="w-full max-w-[460px] space-y-6">
          <MerchantBranding merchantName="Merchant" />
          <div className="rounded-xl border border-border bg-card p-8 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <div className="h-8 w-8 animate-pulse rounded-full bg-muted-foreground/20" />
            </div>
          </div>
          <TrustBadges />
        </div>
      </div>
    );
  }

  const referenceId = `TVP-${payment?.id?.substring(0, 6).toUpperCase() || "UNKNOWN"}`;
  const merchantName = payment?.merchant?.name || "Merchant";
  const amount = payment?.amount || 0;
  const currency = payment?.currency || "USD";
  const redirectUrl = (payment?.metadata as any)?.redirect_url;
  const receiptEmail = (payment?.metadata as any)?.receipt_email;

  return (
    <div className="flex min-h-screen justify-center bg-muted/30 px-4 py-8 sm:px-8">
      <div className="w-full max-w-[460px] space-y-6">
        <MerchantBranding
          merchantName={merchantName}
          merchantLogo={payment?.merchant?.logo}
        />

        <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green/10">
              <CheckCircle size={40} weight="fill" className="text-green" />
            </div>
            <h2 className="mt-4 font-display text-lg font-semibold text-foreground">
              Payment successful
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your payment has been confirmed and will be processed shortly.
            </p>
          </div>

          <div className="mt-8">
            <SuccessCard
              amount={amount}
              currency={currency}
              merchantName={merchantName}
              referenceId={referenceId}
              receiptEmail={receiptEmail}
            />
          </div>

          {redirectUrl ? (
            <div className="mt-8 pt-8 border-t border-border">
              <RedirectCountdown redirectUrl={redirectUrl} seconds={5} />
            </div>
          ) : (
            <button
              onClick={() => router.back()}
              className="mt-6 w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:brightness-110"
            >
              Return to merchant
            </button>
          )}
        </div>

        <TrustBadges />
      </div>
    </div>
  );
}