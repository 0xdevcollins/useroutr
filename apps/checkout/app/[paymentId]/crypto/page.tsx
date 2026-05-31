"use client";
import { OrderSummary } from "@/components/OrderSummary";
import { CryptoPayment } from "@/components/CryptoPayment";
import { TrustBadges } from "@/components/TrustBadges";
import { MerchantBranding } from "@/components/MerchantBranding";
import { usePayment } from "@/hooks/usePayment";
import { useParams } from "next/navigation";

/**
 * Crypto checkout page. Composes:
 *   - MerchantBranding (logo + name)
 *   - OrderSummary (amount + description)
 *   - CryptoPayment (the actual CCTP V2 flow — chain picker → quote → sign → poll)
 *
 * QuoteCountdown was removed in PR 7.8c: the quote is now scoped to the
 * crypto leg (30s) rather than the whole payment, and CryptoPayment shows
 * the lock window inline when a quote is active. The page-level countdown
 * was confusing customers between the 30-min payment expiry and the 30s
 * quote lock — collapsed into one place.
 */
export default function CryptoPaymentPage() {
  const params = useParams();
  const paymentId = params.paymentId as string;
  const { data: payment } = usePayment(paymentId);

  if (!payment) {
    return (
      <div className="flex min-h-screen justify-center items-center bg-muted/30">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-sm text-muted-foreground">
            Loading payment details...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen justify-center bg-muted/30 px-4 py-8 sm:px-8">
      <div className="w-full max-w-115 space-y-6">
        <MerchantBranding merchantName={payment.merchantName} />
        <OrderSummary
          amount={payment.amount}
          currency={payment.currency}
          description={payment.description}
        />
        <CryptoPayment
          paymentId={paymentId}
          merchantAmount={payment.amount}
          merchantCurrency={payment.currency}
        />
        <TrustBadges />
      </div>
    </div>
  );
}
