import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CctpService } from '../cctp/cctp.service';
import { PaymentsService } from './payments.service';
import {
  CCTP_OBSERVE_QUEUE,
  CCTP_OBSERVE_JOB,
  CCTP_RETRY_DELAYS_MS,
  CCTP_MAX_ATTEMPTS,
  type CctpObserveJobData,
} from './cctp.constants';

/**
 * Drives a single customer crypto payment from SOURCE_LOCKED (burn signed
 * + tx broadcast on the source chain) through to COMPLETED (USDC minted
 * on Stellar by Circle's Forwarding Service).
 *
 * Flow:
 *   1. CctpService.observe(sourceTxHash, sourceChain)
 *      - parses the source burn receipt → extracts nonce + amount + recipient
 *      - polls Iris until attestation status === 'complete'
 *      - if Iris carries forwardTxHash, mint is already on-chain
 *   2. Patch Payment row with cctpNonce + cctpAttestation, status=PROCESSING
 *   3. If we have a destination tx hash from the Forwarder, status=COMPLETED
 *      and destTxHash recorded (webhook fires from updateStatus)
 *
 * Failure modes:
 *   - Attestation never completes (Iris down, finality stalled) → retry
 *     per CCTP_RETRY_DELAYS_MS, then status=FAILED with cctpError stashed
 *     in payment.metadata so the dashboard can surface a real message.
 *   - Source tx receipt missing (RPC lag) → retry; the inner observer
 *     already waits, so this is a true outage.
 */
@Processor(CCTP_OBSERVE_QUEUE)
@Injectable()
export class CctpProcessor extends WorkerHost {
  private readonly logger = new Logger(CctpProcessor.name);

  constructor(
    @InjectQueue(CCTP_OBSERVE_QUEUE) private readonly queue: Queue,
    private readonly prisma: PrismaService,
    private readonly cctp: CctpService,
    // forwardRef because PaymentsService injects the queue via @InjectQueue,
    // which Nest resolves through the same module — circular at the type
    // level even though the runtime graph is fine. forwardRef defers
    // resolution to runtime.
    @Inject(forwardRef(() => PaymentsService))
    private readonly payments: PaymentsService,
  ) {
    super();
  }

  async process(job: Job<CctpObserveJobData>): Promise<void> {
    if (job.name !== CCTP_OBSERVE_JOB) {
      throw new Error(`Unknown job name: ${job.name}`);
    }

    const { paymentId, sourceTxHash, sourceChain, attempt } = job.data;
    this.logger.log(
      `Observing burn ${sourceTxHash} (payment=${paymentId}, attempt=${attempt}/${CCTP_MAX_ATTEMPTS})`,
    );

    try {
      const record = await this.cctp.observe(sourceTxHash, sourceChain);

      // Step 1: PROCESSING — attestation is in. Record the nonce + the
      // attestation blob (used later for refunds + audits).
      await this.payments.updateStatus(paymentId, PaymentStatus.PROCESSING, {
        cctpNonce: record.burn.nonce.toString(),
        cctpAttestation: record.attestation.attestation ?? null,
      });

      // Step 2: COMPLETED — if Iris reports a forwardTxHash, Circle's
      // Forwarding Service has already broadcast the destination mint.
      // That's our finality signal. Without it, we're in self-relay land
      // (out of scope for v1 — log loudly and leave the payment in
      // PROCESSING for manual reconciliation).
      if (record.mintTxHash) {
        await this.payments.updateStatus(paymentId, PaymentStatus.COMPLETED, {
          destTxHash: record.mintTxHash,
        });
        this.logger.log(
          `Payment ${paymentId} COMPLETED — destTxHash=${record.mintTxHash}`,
        );
      } else {
        this.logger.warn(
          `No forwardTxHash on attestation for ${paymentId} — self-relay path not implemented in v1. Payment left in PROCESSING.`,
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `cctp.observe failed for payment ${paymentId} (attempt ${attempt}): ${message}`,
      );

      if (attempt < CCTP_MAX_ATTEMPTS) {
        const delay = CCTP_RETRY_DELAYS_MS[attempt - 1];
        await this.queue.add(
          CCTP_OBSERVE_JOB,
          {
            paymentId,
            sourceTxHash,
            sourceChain,
            attempt: attempt + 1,
          },
          { delay, attempts: 1 },
        );
        this.logger.log(
          `Re-enqueued observe job for ${paymentId} with ${delay}ms delay (next attempt ${attempt + 1})`,
        );
      } else {
        // Exhausted — flip to FAILED with the underlying error stashed
        // so the customer-facing crypto-status endpoint can surface it.
        await this.payments.updateStatus(paymentId, PaymentStatus.FAILED, {
          metadata: mergeFailureMetadata(message),
        });
        this.logger.error(
          `Payment ${paymentId} FAILED after ${CCTP_MAX_ATTEMPTS} observe attempts: ${message}`,
        );
      }

      // Always throw so BullMQ records the job failure; the retry was
      // re-enqueued above (or we already flipped to FAILED).
      throw new Error(`cctp.observe failed: ${message}`);
    }
  }
}

function mergeFailureMetadata(error: string): Prisma.InputJsonValue {
  // The updateStatus caller will spread this into the payment metadata
  // alongside whatever already lives there. Keeping the failure shape
  // here so the contract is co-located with the worker that writes it.
  return {
    cctpError: error,
    failedAt: new Date().toISOString(),
  } as Prisma.InputJsonValue;
}
