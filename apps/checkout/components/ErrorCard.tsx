"use client";

import { WarningCircle } from "@phosphor-icons/react/dist/ssr";
import type { PaymentStatus } from "@useroutr/types";

type ErrorInfo = { title: string; message: string };

/// Keyed by payment status (what `ConfirmPageClient` passes) plus the
/// client-side failure codes the wallet step can raise.
const ERROR_MESSAGES: Partial<Record<PaymentStatus, ErrorInfo>> &
  Record<string, ErrorInfo> = {
  EXPIRED: {
    title: "Quote expired",
    message:
      "The locked exchange rate expired before the payment settled. Please start the payment again to get a fresh quote.",
  },
  REFUNDING: {
    title: "Refund in progress",
    message:
      "This payment couldn't be settled, so your funds are being returned to the wallet you paid from.",
  },
  REFUNDED: {
    title: "Payment refunded",
    message:
      "This payment was refunded to the wallet you paid from. Nothing was charged.",
  },
  ATTESTATION_TIMEOUT: {
    title: "Transfer is taking longer than usual",
    message:
      "Circle hasn't attested your transfer yet, so we can't release the funds on Stellar. This usually clears on its own — contact support if it doesn't.",
  },
  INSUFFICIENT_LIQUIDITY: {
    title: "Conversion not available",
    message:
      "We couldn't find a conversion path for this amount. Please try a different payment method.",
  },
  NETWORK_ERROR: {
    title: "Connection lost",
    message:
      "We lost connection. Please check your internet and try again.",
  },
  WALLET_REJECTED: {
    title: "Transaction cancelled",
    message:
      "The transaction was cancelled in your wallet.",
  },
  FAILED: {
    title: "Payment failed",
    message:
      "Something went wrong processing your payment. Please try again.",
  },
};

interface ErrorCardProps {
  errorType?: string;
  onRetry?: () => void;
  onSupportClick?: () => void;
}

export function ErrorCard({
  errorType = "FAILED",
  onRetry,
  onSupportClick,
}: ErrorCardProps) {
  const errorInfo = ERROR_MESSAGES[errorType] || ERROR_MESSAGES.FAILED;

  return (
    <div className="rounded-xl border border-red/20 bg-red/5 p-6">
      <div className="flex gap-4">
        <div className="flex-shrink-0">
          <WarningCircle
            size={24}
            weight="fill"
            className="text-red"
          />
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-foreground">{errorInfo.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {errorInfo.message}
          </p>
          <div className="mt-4 flex gap-2">
            {onRetry && (
              <button
                onClick={onRetry}
                className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:brightness-110"
              >
                Try again
              </button>
            )}
            {onSupportClick && (
              <button
                onClick={onSupportClick}
                className="flex-1 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                Contact support
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}