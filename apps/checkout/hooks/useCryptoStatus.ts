import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

/**
 * Shape returned by `GET /v1/checkout/:paymentId/crypto-status`. Matches
 * the PaymentStatus enum on the API side — frontend treats it as opaque
 * strings and branches on the well-known values it cares about.
 */
export interface CryptoStatus {
  status:
    | "PENDING"
    | "QUOTE_LOCKED"
    | "SOURCE_LOCKED"
    | "PROCESSING"
    | "COMPLETED"
    | "FAILED"
    | "EXPIRED"
    | "REFUNDED"
    | "REFUNDING";
  sourceTxHash: string | null;
  sourceExplorerUrl: string | null;
  attestation: { status: "pending" | "complete" } | null;
  destTxHash: string | null;
  destExplorerUrl: string | null;
  error: string | null;
}

const TERMINAL_STATUSES = new Set(["COMPLETED", "FAILED", "REFUNDED", "EXPIRED"]);

/**
 * Poll-able status surface. Refetches every 3s while the payment is
 * actively transitioning (SOURCE_LOCKED → PROCESSING) and stops once it
 * hits a terminal state (COMPLETED / FAILED / etc.). Disabled until the
 * customer has actually submitted a burn — before that, the static
 * payment data from `usePayment` is enough.
 */
export function useCryptoStatus(paymentId: string, enabled: boolean) {
  return useQuery<CryptoStatus>({
    queryKey: ["crypto-status", paymentId],
    queryFn: () =>
      api.get<CryptoStatus>(`/checkout/${paymentId}/crypto-status`),
    enabled: enabled && !!paymentId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && TERMINAL_STATUSES.has(status) ? false : 3000;
    },
    refetchIntervalInBackground: false,
    retry: false,
  });
}
