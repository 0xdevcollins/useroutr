import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { MerchantSettlementService } from './merchant-settlement.service';
import {
  SETTLEMENT_PROVISION_QUEUE,
  PROVISION_WALLET_JOB,
  PROVISION_RETRY_DELAYS_MS,
  PROVISION_MAX_ATTEMPTS,
  PROVISION_JOB_CLEANUP,
  type ProvisionWalletJobData,
} from './settlement-provision.constants';

/**
 * Provisions a merchant's settlement wallet outside the signup request.
 *
 * Registration used to await this, which meant every new merchant waited on
 * two Stellar round trips — Friendbot funding, then a trustline that waits for
 * a ledger close — before their account existed. Typically ~10s, and it tracks
 * testnet latency, so a slow third party made signup slow for everyone.
 *
 * `provision` is idempotent: it returns the existing address if the merchant
 * already has one, so a retry after a partial failure cannot mint a second
 * wallet.
 */
@Processor(SETTLEMENT_PROVISION_QUEUE)
@Injectable()
export class SettlementProvisionProcessor extends WorkerHost {
  private readonly logger = new Logger(SettlementProvisionProcessor.name);

  constructor(
    @InjectQueue(SETTLEMENT_PROVISION_QUEUE) private readonly queue: Queue,
    private readonly settlement: MerchantSettlementService,
  ) {
    super();
  }

  async process(job: Job<ProvisionWalletJobData>): Promise<void> {
    if (job.name !== PROVISION_WALLET_JOB) {
      throw new Error(`Unknown job name: ${job.name}`);
    }

    const { merchantId } = job.data;
    const attempt = (job.data as { attempt?: number }).attempt ?? 1;

    try {
      const { stellarAddress } = await this.settlement.provision(merchantId);
      this.logger.log(
        `Provisioned settlement wallet for ${merchantId}: ${stellarAddress}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      if (attempt >= PROVISION_MAX_ATTEMPTS) {
        // Not fatal for the merchant: the dashboard exposes a manual retry,
        // and nothing about the account is broken without a wallet — they
        // simply cannot receive settlements until one exists.
        this.logger.error(
          `Settlement provisioning for ${merchantId} gave up after ${attempt} attempts: ${message}. Merchant can retry from the dashboard.`,
        );
        return;
      }

      const delay = PROVISION_RETRY_DELAYS_MS[attempt - 1];
      this.logger.warn(
        `Settlement provisioning for ${merchantId} failed (attempt ${attempt}/${PROVISION_MAX_ATTEMPTS}): ${message}. Retrying in ${delay}ms`,
      );
      await this.queue.add(
        PROVISION_WALLET_JOB,
        { merchantId, attempt: attempt + 1 },
        { delay, ...PROVISION_JOB_CLEANUP },
      );
    }
  }
}
