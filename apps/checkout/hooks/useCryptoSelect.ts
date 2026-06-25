import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";

/**
 * Shape returned by `POST /v1/checkout/:paymentId/select-crypto`. The
 * `wallet.approve` and `wallet.burn` blobs are EIP-1193-style calldata
 * the customer signs via wagmi's `useSendTransaction`. The server is
 * the only place that knows the CCTP V2 ABI.
 */
export interface CryptoSelectResponse {
  quote: {
    id: string;
    fromAmount: string;
    fromAsset: string;
    fromChain: string;
    toAmount: string;
    toAsset: string;
    toChain: string;
    rate: string;
    fee: string;
    feeBps: number;
    expiresAt: string;
    expiresInSeconds: number;
  };
  wallet: {
    chainId: number;
    approve: WalletCall;
    burn: WalletCall;
  };
}

export interface WalletCall {
  to: string;
  data: string;
  value: "0x0";
  description: string;
}

/**
 * Lock a crypto quote for this payment. Idempotent on retry — calling
 * again with the same `sourceChain` returns the existing quote unless
 * it's expired, in which case a fresh one is minted.
 */
export function useCryptoSelect(paymentId: string) {
  return useMutation<CryptoSelectResponse, Error, { sourceChain: string }>({
    mutationKey: ["crypto-select", paymentId],
    mutationFn: ({ sourceChain }) =>
      api.post<CryptoSelectResponse>(
        `/checkout/${paymentId}/select-crypto`,
        { sourceChain },
      ),
  });
}
