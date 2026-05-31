/**
 * Constants for the CCTP V2 attestation worker that drives a customer
 * crypto payment from SOURCE_LOCKED → PROCESSING → COMPLETED.
 *
 * The queue lives in PaymentsModule (not CctpModule) so the worker can
 * inject both `CctpService` (already imported one-way) and
 * `PaymentsService` (provided in-module) without a circular dependency.
 */

export const CCTP_OBSERVE_QUEUE = 'cctp.observe';

/** BullMQ job name within the `cctp.observe` queue. */
export const CCTP_OBSERVE_JOB = 'observe-burn';

/**
 * Retry schedule. The inner attestation poller (CctpService.observe) does
 * its own backoff against Iris — this is the outer safety net for
 * transient RPC failures (source-chain receipt fetch, etc.).
 */
export const CCTP_RETRY_DELAYS_MS = [5_000, 30_000, 120_000];
export const CCTP_MAX_ATTEMPTS = CCTP_RETRY_DELAYS_MS.length;

export interface CctpObserveJobData {
  paymentId: string;
  sourceTxHash: string;
  sourceChain: string;
  /** 1-indexed for parity with WebhooksProcessor. */
  attempt: number;
}
