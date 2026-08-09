/** Queue driving the release of held settlements. */
export const SETTLEMENT_HOLD_QUEUE = 'settlement.hold';

/** Releases one payment's hold once its window has elapsed. */
export const RELEASE_HOLD_JOB = 'release-hold';

export interface ReleaseHoldJobData {
  paymentId: string;
}

/**
 * Written to `Payment.escrowState` for a ledger-only hold. Escrow-backed
 * payments carry the contract's own state names instead, so a glance at the
 * column says which kind of hold a payment got.
 */
export const HOLD_STATE_HELD = 'HELD';
export const HOLD_STATE_RELEASED = 'RELEASED';

export const HOLD_JOB_CLEANUP = {
  removeOnComplete: { age: 86_400, count: 1_000 },
  removeOnFail: { age: 604_800 },
} as const;
