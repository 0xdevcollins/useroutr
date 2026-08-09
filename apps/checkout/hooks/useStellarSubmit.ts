import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";

/**
 * Report a signed Stellar payment. The hash tells the API *where to look*;
 * it verifies destination, asset and amount against the ledger itself, so a
 * hash we report wrongly is rejected rather than believed.
 */
export function useStellarSubmit(paymentId: string) {
  return useMutation<
    { status: string; stellarTxHash: string },
    Error,
    { txHash: string }
  >({
    mutationKey: ["stellar-submitted", paymentId],
    mutationFn: (body) =>
      api.post(`/checkout/${paymentId}/stellar-submitted`, body),
  });
}
