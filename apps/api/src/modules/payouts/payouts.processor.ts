import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PayoutsService } from './payouts.service';
import {
  EXECUTE_PAYOUT_BATCH_JOB,
  EXECUTE_PAYOUT_JOB,
  GENERATE_RECURRING_PAYOUT_JOB,
  RUN_RECURRING_PAYOUTS_JOB,
  type GenerateRecurringPayoutJobData,
  type ExecutePayoutBatchJobData,
  type ExecutePayoutJobData,
  PAYOUTS_QUEUE,
} from './payouts.constants';

type PayoutJobData =
  | ExecutePayoutJobData
  | ExecutePayoutBatchJobData
  | GenerateRecurringPayoutJobData;

@Injectable()
@Processor(PAYOUTS_QUEUE)
export class PayoutsProcessor extends WorkerHost {
  private readonly logger = new Logger(PayoutsProcessor.name);

  constructor(private readonly payoutsService: PayoutsService) {
    super();
  }

  async process(job: Job<PayoutJobData>): Promise<void> {
    if (job.name === EXECUTE_PAYOUT_JOB) {
      const data = job.data as ExecutePayoutJobData;
      await this.payoutsService.processQueuedPayout(data.payoutId);
      return;
    }

    if (job.name === EXECUTE_PAYOUT_BATCH_JOB) {
      const data = job.data as ExecutePayoutBatchJobData;
      await this.payoutsService.processQueuedBatch(data.batchId);
      return;
    }

    if (job.name === GENERATE_RECURRING_PAYOUT_JOB) {
      const data = job.data as GenerateRecurringPayoutJobData;
      await this.payoutsService.processRecurringPayout(
        data.recurringPayoutId,
      );
      return;
    }

    if (job.name === RUN_RECURRING_PAYOUTS_JOB) {
      await this.payoutsService.processDueRecurringPayouts();
      return;
    }

    this.logger.warn(`Unknown payout job ignored: ${job.name}`);
  }
}
