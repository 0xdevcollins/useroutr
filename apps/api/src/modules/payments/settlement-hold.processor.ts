import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PaymentsService } from './payments.service';
import {
  SETTLEMENT_HOLD_QUEUE,
  RELEASE_HOLD_JOB,
  type ReleaseHoldJobData,
} from './settlement-hold.constants';

/**
 * Releases a settlement hold once its window has elapsed.
 *
 * Held funds sit in `MerchantBalance.reservedAmount` and are unspendable, so a
 * release that never runs is indistinguishable from losing the merchant's
 * money. That is why this reconciles on boot as well as reacting to jobs: a
 * redeploy between the hold starting and the window closing would otherwise
 * drop the only scheduled job and strand the balance silently.
 */
@Processor(SETTLEMENT_HOLD_QUEUE)
@Injectable()
export class SettlementHoldProcessor
  extends WorkerHost
  implements OnApplicationBootstrap
{
  private readonly logger = new Logger(SettlementHoldProcessor.name);

  constructor(private readonly payments: PaymentsService) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    try {
      const count = await this.payments.reconcileSettlementHolds();
      if (count > 0) {
        this.logger.log(`Reconciled ${count} settlement hold(s)`);
      }
    } catch (err) {
      // Never block startup on this — a failed sweep is recoverable, a crash
      // loop is not.
      this.logger.error(
        `Failed to reconcile settlement holds: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async process(job: Job<ReleaseHoldJobData>): Promise<void> {
    if (job.name !== RELEASE_HOLD_JOB) {
      throw new Error(`Unknown job name: ${job.name}`);
    }

    const { paymentId } = job.data;
    await this.payments.releaseSettlementHold(paymentId);
    this.logger.log(`Released settlement hold for payment ${paymentId}`);
  }
}
