import { OrderSummary } from "@/components/OrderSummary";
import { PaymentMethodSelector } from "@/components/PaymentMethodSelector";
import { TrustBadges } from "@/components/TrustBadges";
import { MerchantBranding } from "@/components/MerchantBranding";

export default async function PaymentPage({
  params,
}: {
  params: Promise<{ paymentId: string }>;
}) {
  const { paymentId } = await params;

  return (
    <div className="flex min-h-screen justify-center bg-muted/30 px-4 py-8 sm:px-8">
      <div className="w-full max-w-[460px] space-y-6">
        <MerchantBranding />
        <OrderSummary />
        <PaymentMethodSelector paymentId={paymentId} />
        <TrustBadges />
      </div>
    </div>
  );
}
