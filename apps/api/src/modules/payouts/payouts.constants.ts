export const PAYOUTS_QUEUE = 'payouts';

export const EXECUTE_PAYOUT_JOB = 'execute-payout';
export const EXECUTE_PAYOUT_BATCH_JOB = 'execute-payout-batch';
export const GENERATE_RECURRING_PAYOUT_JOB = 'generate-recurring-payout';

export interface ExecutePayoutJobData {
  payoutId: string;
}

export interface ExecutePayoutBatchJobData {
  batchId: string;
}

export interface GenerateRecurringPayoutJobData {
  recurringPayoutId: string;
}

export const PAYOUT_JOB_CLEANUP = {
  removeOnComplete: {
    age: 7 * 24 * 60 * 60,
    count: 1000,
  },
  removeOnFail: {
    age: 30 * 24 * 60 * 60,
  },
};
