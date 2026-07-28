import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PayoutsService } from './payouts.service';
import {
  EXECUTE_PAYOUT_BATCH_JOB,
  EXECUTE_PAYOUT_JOB,
  type ExecutePayoutBatchJobData,
  type ExecutePayoutJobData,
  PAYOUTS_QUEUE,
} from './payouts.constants';

type PayoutJobData = ExecutePayoutJobData | ExecutePayoutBatchJobData;

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

    this.logger.warn(`Unknown payout job ignored: ${job.name}`);
  }
}
