import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { RelayService } from './relay.service';
import { PaymentsService } from '../payments/payments.service';
import { StellarService } from '../stellar/stellar.service';
import { BridgeRouterService } from '../bridge/bridge-router.service';
import { PaymentStatus } from '../../generated/prisma';
import { Logger } from '@nestjs/common';

@Processor('relay')
export class RelayProcessor extends WorkerHost {
  private readonly logger = new Logger(RelayProcessor.name);
  private readonly DEFAULT_BACKOFF = {
    type: 'exponential',
    delay: 1000,
  };

  constructor(
    @InjectQueue('relay') private readonly relayQueue: Queue,
    private readonly relayService: RelayService,
    private readonly paymentsService: PaymentsService,
    private readonly stellarService: StellarService,
    private readonly bridgeRouter: BridgeRouterService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.debug(`Processing job ${job.id} of type ${job.name}`);

    switch (job.name) {
      case 'watchExpired':
        return this.relayService.processExpiredLocks();

      case 'completeStellarLock':
        return this.handleCompleteStellarLock(job.data);

      case 'withdrawStellar':
        return this.handleWithdrawStellar(job.data);

      case 'completeSourceUnlock':
        return this.handleCompleteSourceUnlock(job.data);

      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }

  private async handleCompleteStellarLock(data: { paymentId: string }) {
    this.logger.log(`Completing Stellar lock for payment ${data.paymentId}`);

    const payment = await this.paymentsService.getById(data.paymentId);
    if (!payment || payment.status !== PaymentStatus.SOURCE_LOCKED) {
      this.logger.warn(
        `Payment ${data.paymentId} not in SOURCE_LOCKED status or not found`,
      );
      return;
    }

    try {
      const stellarTxHash = await this.stellarService.lockHTLC({
        sender: 'useroutr_vault',
        receiver: payment.destAddress,
        token: payment.destAsset,
        amount: BigInt(Math.floor(Number(payment.destAmount))),
        hashlock: payment.hashlock!,
        timelock: Math.floor(Date.now() / 1000) + 3600,
      });

      await this.paymentsService.updateStatus(
        payment.id,
        PaymentStatus.STELLAR_LOCKED,
        {
          stellarLockId: payment.id, // Simplified assumption
          stellarTxHash,
        },
      );

      this.logger.log(
        `Stellar lock completed for payment ${payment.id}, tx: ${stellarTxHash}`,
      );

      // Automatically trigger withdrawal if we have the secret
      if ((payment as any).htlcSecret) {
        await this.relayQueue.add(
          'withdrawStellar',
          { paymentId: payment.id },
          {
            attempts: 10,
            backoff: this.DEFAULT_BACKOFF,
          },
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Failed to complete Stellar lock for ${payment.id}: ${message}`,
      );
      throw err;
    }
  }

  private async handleWithdrawStellar(data: { paymentId: string }) {
    this.logger.log(
      `Initiating Stellar withdrawal for payment ${data.paymentId}`,
    );

    const payment = await this.paymentsService.getById(data.paymentId);
    if (!payment || payment.status !== PaymentStatus.STELLAR_LOCKED) {
      this.logger.warn(
        `Payment ${data.paymentId} not in STELLAR_LOCKED status or not found`,
      );
      return;
    }

    if (!(payment as any).htlcSecret) {
      this.logger.error(
        `No HTLC secret found for payment ${data.paymentId}. Cannot withdraw.`,
      );
      return;
    }

    try {
      const stellarLockId = payment.stellarLockId || payment.id;
      const stellarTxHash = await this.stellarService.withdrawHTLC(
        stellarLockId,
        (payment as any).htlcSecret,
      );

      await this.paymentsService.updateStatus(
        payment.id,
        PaymentStatus.PROCESSING,
        {
          stellarTxHash,
        },
      );

      this.logger.log(
        `Stellar withdrawal initiated for ${payment.id}, tx: ${stellarTxHash}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Failed to initiate Stellar withdrawal for ${payment.id}: ${message}`,
      );
      throw err;
    }
  }

  private async handleCompleteSourceUnlock(data: {
    paymentId: string;
    preimage: string;
  }) {
    this.logger.log(`Completing source unlock for payment ${data.paymentId}`);

    const payment = await this.paymentsService.getById(data.paymentId);
    const validStatuses = [
      PaymentStatus.STELLAR_LOCKED,
      PaymentStatus.PROCESSING,
    ];

    if (!payment || !validStatuses.includes(payment.status)) {
      this.logger.warn(
        `Payment ${data.paymentId} not in valid status for completion: ${payment?.status}`,
      );
      return;
    }

    try {
      if (payment.status !== PaymentStatus.PROCESSING) {
        await this.paymentsService.updateStatus(
          payment.id,
          PaymentStatus.PROCESSING,
        );
      }

      const txHash = await this.bridgeRouter.completeSourceLock({
        chain: payment.sourceChain as any,
        lockId: payment.sourceLockId!,
        preimage: data.preimage,
      });

      await this.paymentsService.updateStatus(
        payment.id,
        PaymentStatus.COMPLETED,
        {
          destTxHash: txHash,
        },
      );

      this.logger.log(
        `Source unlock completed for payment ${payment.id}, tx: ${txHash}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Failed to complete source unlock for ${payment.id}: ${message}`,
      );
      throw err;
    }
  }
}
