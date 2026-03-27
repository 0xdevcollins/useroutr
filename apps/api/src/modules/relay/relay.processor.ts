import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { RelayService } from './relay.service';
import { PaymentsService } from '../payments/payments.service';
import { StellarService } from '../stellar/stellar.service';
import { BridgeRouterService } from '../bridge/bridge-router.service';
import { PaymentStatus } from '../../generated/prisma';
import { Logger } from '@nestjs/common';

@Processor('relay')
export class RelayProcessor extends WorkerHost {
  private readonly logger = new Logger(RelayProcessor.name);

  constructor(
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
      
      case 'completeSourceUnlock':
        return this.handleCompleteSourceUnlock(job.data);
      
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }

  private async handleCompleteStellarLock(data: { paymentId: string }) {
    this.logger.log(`Completing Stellar lock for payment ${data.paymentId}`);
    
    const payment = await this.paymentsService.findById(data.paymentId);
    if (!payment || payment.status !== PaymentStatus.SOURCE_LOCKED) {
        this.logger.warn(`Payment ${data.paymentId} not in SOURCE_LOCKED status or not found`);
        return;
    }

    try {
        // Trigger Stellar path payment + HTLC lock on Soroban
        const stellarTxHash = await this.stellarService.lockHTLC({
            sender: 'useroutr_vault',
            receiver: payment.destAddress,
            token: payment.destAsset,
            amount: BigInt(payment.destAmount.toString()), // Note: should handle decimals correctly
            hashlock: payment.hashlock!,
            timelock: Math.floor(Date.now() / 1000) + 3600 // 1 hour expiry
        });

        await this.paymentsService.updateStatus(payment.id, PaymentStatus.STELLAR_LOCKED, stellarTxHash);
        this.logger.log(`Stellar lock completed for payment ${payment.id}, tx: ${stellarTxHash}`);
    } catch (err) {
        this.logger.error(`Failed to complete Stellar lock for ${payment.id}: ${err.message}`);
        throw err; // Retry via BullMQ
    }
  }

  private async handleCompleteSourceUnlock(data: { paymentId: string, preimage: string }) {
    this.logger.log(`Completing source unlock for payment ${data.paymentId}`);
    
    const payment = await this.paymentsService.findById(data.paymentId);
    if (!payment || payment.status !== PaymentStatus.STELLAR_LOCKED) {
        this.logger.warn(`Payment ${data.paymentId} not in STELLAR_LOCKED status or not found`);
        return;
    }

    try {
        await this.paymentsService.updateStatus(payment.id, PaymentStatus.PROCESSING);

        const txHash = await this.bridgeRouter.completeSourceLock({
            chain: payment.sourceChain as any,
            lockId: payment.sourceLockId!,
            preimage: data.preimage
        });

        await this.paymentsService.updateStatus(payment.id, PaymentStatus.COMPLETED, txHash);
        this.logger.log(`Source unlock completed for payment ${payment.id}, tx: ${txHash}`);
    } catch (err) {
        this.logger.error(`Failed to complete source unlock for ${payment.id}: ${err.message}`);
        throw err; // Retry via BullMQ
    }
  }
}
