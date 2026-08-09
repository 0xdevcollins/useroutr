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
  /** Which shape the payer signs. Set by the server per source chain. */
  method: "evm" | "stellar";
  /** Present when `method === "evm"`. */
  wallet?: {
    chainId: number;
    approve: WalletCall;
    burn: WalletCall;
  };
  /**
   * Present when `method === "stellar"`. A payer already on the settlement
   * chain has nothing to bridge — they send a payment directly.
   */
  stellar?: {
    destination: string;
    asset: { code: string; issuer: string };
    amount: string;
    memo: string;
    networkPassphrase: string;
  };
}

/**
 * A response already narrowed to the EVM shape. `wallet` is optional on the
 * union because a Stellar payer has no calldata to sign; components that only
 * handle EVM should narrow once at the boundary rather than checking on every
 * access.
 */
export type EvmCryptoSelectResponse = CryptoSelectResponse & {
  method: "evm";
  wallet: NonNullable<CryptoSelectResponse["wallet"]>;
};

export function isEvmSelect(
  res: CryptoSelectResponse,
): res is EvmCryptoSelectResponse {
  return res.method === "evm" && res.wallet !== undefined;
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
