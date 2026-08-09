/** Queue driving settlement-wallet provisioning away from the signup request. */
export const SETTLEMENT_PROVISION_QUEUE = 'settlement.provision';

/** Provisions one merchant's managed Stellar settlement wallet. */
export const PROVISION_WALLET_JOB = 'provision-wallet';

export interface ProvisionWalletJobData {
  merchantId: string;
}

/**
 * Provisioning makes two live Stellar round trips — funding the account, then
 * a trustline that waits for a ledger close. Both fail on transient network
 * trouble far more often than on anything permanent, so retries are generous
 * and spread out rather than tight.
 */
export const PROVISION_RETRY_DELAYS_MS = [5_000, 30_000, 120_000, 600_000];
export const PROVISION_MAX_ATTEMPTS = PROVISION_RETRY_DELAYS_MS.length;

export const PROVISION_JOB_CLEANUP = {
  removeOnComplete: { age: 86_400, count: 1_000 },
  removeOnFail: { age: 604_800 },
};
