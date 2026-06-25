/**
 * Domain types for the CCTP V2 module. These flow across the service
 * boundary — keep them stable, document additions, and don't leak
 * Prisma / ABI types into them.
 */

/**
 * Fast = ~8–20s, paid for via a small per-transfer USDC fee.
 * Standard = waits for hard finality (15–19 min on EVM), effectively free.
 *
 * The `minFinalityThreshold` argument we pass to `depositForBurnWithHook`
 * encodes this: ≤ 1000 picks Fast, > 1000 picks Standard.
 */
export type CctpSpeed = 'fast' | 'standard';

/**
 * Where the destination mint executes — Circle's Forwarding Service
 * (recommended; Circle pays gas) or self-relay (we sign the mint
 * ourselves, costing us native gas on the destination chain). Migration
 * plan locked Forwarding only for v1.
 */
export type MintMode = 'forwarder' | 'self-relay';

/**
 * Quoted fee from Circle's fee-estimate API, in source-chain USDC
 * subunits (6-decimal precision on EVM, 7-decimal on Stellar — caller
 * is responsible for matching unit). Stored on the Quote row so the
 * customer is charged the exact amount that was quoted.
 */
export interface CctpFeeQuote {
  /** Protocol fee (paid in source USDC, deducted from burn amount). */
  protocolFee: bigint;
  /**
   * Forwarding fee, when `mintMode === 'forwarder'`. Covers Circle's gas
   * outlay on the destination chain. Zero for self-relay.
   */
  forwardingFee: bigint;
  /** When this quote expires (unix ms). Re-quote after this. */
  expiresAt: number;
}

/**
 * Input shape for a cross-chain transfer. The CctpService normalizes this
 * into a chain-specific burn call.
 */
export interface CctpTransferRequest {
  /** Source chain id (matches DomainEntry.id). */
  fromChain: string;
  /** Destination chain id (matches DomainEntry.id). */
  toChain: string;
  /**
   * Burn amount in 6-decimal subunits (CCTP message format). The
   * Stellar client scales this by 10× to match Stellar's 7-decimal
   * USDC representation.
   */
  amount: bigint;
  /**
   * Final recipient on the destination chain. For Stellar this is a
   * strkey (G…/C…/M…); for EVM, a 0x-prefixed 20-byte address. Will be
   * encoded to 32 bytes when packed into the CCTP message.
   */
  recipient: string;
  /** Fast or Standard transfer. Default `fast`. */
  speed: CctpSpeed;
  /** Who executes the destination mint. Default `forwarder`. */
  mintMode: MintMode;
  /**
   * Optional caller restriction on the destination. When set, only this
   * address can call `receiveMessage`. Leave undefined to allow any
   * caller (the forwarder uses this). 32 bytes, hex-encoded with 0x.
   */
  destinationCaller?: string;
  /**
   * Maximum fee the caller is willing to pay (in source USDC subunits).
   * Must be ≥ `protocolFee + forwardingFee` from the latest fee quote.
   */
  maxFee: bigint;
  /**
   * Optional bytes32 override for the `mintRecipient` field of
   * `depositForBurnWithHook`. When destination is Stellar, this MUST be
   * the Stellar CctpForwarder contract id (as 32-byte hex) — the
   * end-recipient strkey rides in the hook instead. When destination is
   * EVM, leave unset; the EVM client encodes `recipient` directly.
   *
   * CctpService.prepareBurn fills this in automatically based on the
   * destination kind, so callers normally don't set it.
   */
  mintRecipient?: string;
  /**
   * Optional override for the `hookData` arg of `depositForBurnWithHook`.
   * Like `mintRecipient`, this is normally computed by CctpService from
   * the destination kind + `recipient`. Override only if you're bypassing
   * the Forwarding Service and rolling your own hook contract.
   */
  hookData?: string;
}

/** Result of submitting the burn. Returned synchronously before attestation. */
export interface CctpBurnResult {
  /** Source chain transaction hash. */
  txHash: string;
  /** Source chain domain id (for attestation polling). */
  sourceDomain: number;
  /**
   * Circle's nonce for this burn. Together with the source domain it
   * uniquely identifies the message — used as the idempotency key for
   * attestation lookups.
   */
  nonce: bigint;
}

/** State of an attestation as reported by iris-api. */
export type AttestationStatus = 'pending_confirmations' | 'complete' | 'failed';

export interface AttestationResponse {
  status: AttestationStatus;
  /** Hex-encoded CCTP message bytes. Required for the mint call. */
  message?: string;
  /** Hex-encoded ECDSA signature from Circle's attesters. */
  attestation?: string;
  /** Set when status === 'failed'. Plain English. */
  error?: string;
  /**
   * When `mintMode: 'forwarder'`, this populates once Circle's forwarder
   * has broadcast the mint on the destination. Treat it as "fully
   * settled" — no further action required.
   */
  forwardTxHash?: string;
}

/** End-to-end record of a CCTP transfer for our DB / reporting. */
export interface CctpTransferRecord {
  request: CctpTransferRequest;
  burn: CctpBurnResult;
  attestation: AttestationResponse;
  /** Set once the destination mint is observed (forwarder or self-relay). */
  mintTxHash?: string;
}
