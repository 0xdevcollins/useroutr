import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import {
  DestType,
  MerchantLedgerEntryType,
  Payout,
  PayoutStatus,
  Prisma,
  RecurringPayout,
  RecurringPayoutFrequency,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { StellarService } from '../stellar/stellar.service';
import { EventsService } from '../events/events/events.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MerchantSettlementService } from '../merchant/merchant-settlement.service';
import {
  CreatePayoutDto,
  BulkPayoutDto,
  CreateRecurringPayoutDto,
  UpdateRecurringPayoutDto,
  ConfirmPayoutDto,
} from './dto/create-payout.dto';
import { PayoutFiltersDto } from './dto/payout-filters.dto';
import { randomInt, randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import {
  EXECUTE_PAYOUT_BATCH_JOB,
  EXECUTE_PAYOUT_JOB,
  GENERATE_RECURRING_PAYOUT_JOB,
  RUN_RECURRING_PAYOUTS_JOB,
  PAYOUTS_QUEUE,
  PAYOUT_JOB_CLEANUP,
  type ExecutePayoutBatchJobData,
  type ExecutePayoutJobData,
  type GenerateRecurringPayoutJobData,
  type RunRecurringPayoutsJobData,
} from './payouts.constants';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BulkPayoutResult {
  batchId: string;
  total: number;
  accepted: number;
  rejected: number;
  payouts: Array<{ index: number; payoutId?: string; error?: string }>;
}

type AssetObject = { native?: boolean; code?: string; issuer?: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

function assetToString(asset: AssetObject): string {
  if (asset.native) return 'native';
  return `${asset.code}:${asset.issuer}`;
}

function stellarUsdcAsset(network?: string): string {
  const isMainnet = network?.toLowerCase() === 'mainnet';
  const issuer = isMainnet
    ? 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'
    : 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
  return `USDC:${issuer}`;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class PayoutsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly webhooks: WebhooksService,
    private readonly stellar: StellarService,
    private readonly settlement: MerchantSettlementService,
    private readonly eventsService: EventsService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
    @InjectQueue(PAYOUTS_QUEUE)
    private readonly payoutQueue: Queue<
      | ExecutePayoutJobData
      | ExecutePayoutBatchJobData
      | GenerateRecurringPayoutJobData
      | RunRecurringPayoutsJobData
    >,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.reconcileScheduledPayoutJobs();
    await this.reconcileRecurringPayoutJobs();
    await this.enqueueRecurringDispatcher();
  }

  // ── Create single payout ──────────────────────────────────────────────────

  async create(
    merchantId: string,
    dto: CreatePayoutDto,
    idempotencyKey?: string,
  ): Promise<Payout> {
    // Deduplicate via idempotency key
    if (idempotencyKey) {
      const existing = await this.prisma.payout.findUnique({
        where: { idempotencyKey },
      });
      if (existing) {
        if (existing.merchantId !== merchantId) {
          throw new ConflictException(
            'Idempotency key already used by another merchant',
          );
        }
        return existing;
      }
    }

    let finalDto = { ...dto };

    // If recipientId provided, lookup and merge details
    if (dto.recipientId) {
      const recipient = await this.prisma.recipient.findFirst({
        where: { id: dto.recipientId, merchantId },
      });
      if (!recipient) {
        throw new NotFoundException('Recipient not found');
      }
      finalDto = {
        ...dto,
        recipientName: recipient.name,
        destinationType: recipient.type,
        destination:
          recipient.details as unknown as CreatePayoutDto['destination'],
      };
    }

    const confirmation = await this.buildConfirmationFields(dto.amount);
    const payout = await this.prisma.payout.create({
      data: {
        merchantId,
        recipientId: dto.recipientId ?? null,
        recipientName: finalDto.recipientName,
        destinationType: finalDto.destinationType as DestType,
        destination: finalDto.destination as Prisma.InputJsonValue,
        amount: dto.amount,
        currency: dto.currency,
        status: confirmation
          ? PayoutStatus.REQUIRES_CONFIRMATION
          : PayoutStatus.PENDING,
        scheduledAt: dto.scheduledAt ?? null,
        confirmationCodeHash: confirmation?.hash ?? null,
        confirmationCodeExpiresAt: confirmation?.expiresAt ?? null,
        idempotencyKey: idempotencyKey ?? null,
      },
    });

    this.webhooks
      .dispatch(
        merchantId,
        'payout.initiated',
        this.webhookPayload(payout) as Prisma.InputJsonValue,
      )
      .catch(() => undefined);

    if (confirmation) {
      await this.sendPayoutConfirmationCode(payout, confirmation.code);
    } else {
      await this.enqueuePayout(payout);
    }

    return payout;
  }

  // ── Bulk payout ───────────────────────────────────────────────────────────

  async createBulk(
    merchantId: string,
    dto: BulkPayoutDto,
  ): Promise<BulkPayoutResult> {
    const batchId = randomUUID();
    const results: BulkPayoutResult['payouts'] = [];
    let accepted = 0;
    let rejected = 0;
    let dueNow = 0;

    for (let i = 0; i < dto.payouts.length; i++) {
      const item = dto.payouts[i];
      try {
        let finalItem = { ...item };

        // If recipientId provided, lookup and merge details
        if (item.recipientId) {
          const recipient = await this.prisma.recipient.findFirst({
            where: { id: item.recipientId, merchantId },
          });
          if (!recipient) {
            throw new NotFoundException(
              `Recipient ${item.recipientId} not found`,
            );
          }
          finalItem = {
            ...item,
            recipientName: recipient.name,
            destinationType: recipient.type,
            destination:
              recipient.details as unknown as CreatePayoutDto['destination'],
          };
        }

        const confirmation = await this.buildConfirmationFields(item.amount);
        const payout = await this.prisma.payout.create({
          data: {
            merchantId,
            recipientId: item.recipientId ?? null,
            recipientName: finalItem.recipientName,
            destinationType: finalItem.destinationType as DestType,
            destination: finalItem.destination as Prisma.InputJsonValue,
            amount: item.amount,
            currency: item.currency,
            status: confirmation
              ? PayoutStatus.REQUIRES_CONFIRMATION
              : PayoutStatus.PENDING,
            scheduledAt: item.scheduledAt ?? null,
            confirmationCodeHash: confirmation?.hash ?? null,
            confirmationCodeExpiresAt: confirmation?.expiresAt ?? null,
            batchId,
          },
        });
        results.push({ index: i, payoutId: payout.id });
        accepted++;

        if (confirmation) {
          await this.sendPayoutConfirmationCode(payout, confirmation.code);
        } else if (payout.scheduledAt && payout.scheduledAt > new Date()) {
          await this.enqueuePayout(payout);
        } else {
          dueNow++;
        }
      } catch (err) {
        rejected++;
        results.push({
          index: i,
          error: err instanceof Error ? err.message : 'Failed to create payout',
        });
      }
    }

    this.webhooks
      .dispatch(merchantId, 'payout.initiated', {
        batchId,
        total: dto.payouts.length,
        accepted,
        rejected,
      } as Prisma.InputJsonValue)
      .catch(() => undefined);

    if (dueNow > 0) {
      await this.enqueueBatch(batchId);
    }

    return {
      batchId,
      total: dto.payouts.length,
      accepted,
      rejected,
      payouts: results,
    };
  }

  // ── List ──────────────────────────────────────────────────────────────────

  async list(merchantId: string, filters: PayoutFiltersDto) {
    const where: Prisma.PayoutWhereInput = { merchantId };

    if (filters.status) where.status = filters.status as PayoutStatus;
    if (filters.destinationType)
      where.destinationType = filters.destinationType as DestType;
    if (filters.currency) where.currency = filters.currency;
    if (filters.batchId) where.batchId = filters.batchId;
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
      if (filters.dateTo) where.createdAt.lte = filters.dateTo;
    }

    const [total, payouts] = await Promise.all([
      this.prisma.payout.count({ where }),
      this.prisma.payout.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters.limit,
        skip: filters.offset,
      }),
    ]);

    return {
      total,
      limit: filters.limit,
      offset: filters.offset,
      data: payouts.map((p) => this.formatResponse(p)),
    };
  }

  // ── Get by ID ─────────────────────────────────────────────────────────────

  async getById(id: string, merchantId: string): Promise<Payout> {
    const payout = await this.prisma.payout.findUnique({ where: { id } });
    if (!payout || payout.merchantId !== merchantId) {
      throw new NotFoundException('Payout not found');
    }
    return payout;
  }

  async confirm(
    id: string,
    merchantId: string,
    dto: ConfirmPayoutDto,
  ): Promise<Payout> {
    const payout = await this.getById(id, merchantId);
    if (payout.status !== PayoutStatus.REQUIRES_CONFIRMATION) {
      throw new BadRequestException(
        `Cannot confirm a payout in ${payout.status} status`,
      );
    }
    if (
      !payout.confirmationCodeHash ||
      !payout.confirmationCodeExpiresAt ||
      payout.confirmationCodeExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('Payout confirmation code is expired');
    }

    const ok = await bcrypt.compare(dto.code, payout.confirmationCodeHash);
    if (!ok) {
      throw new BadRequestException('Invalid payout confirmation code');
    }

    const confirmed = await this.prisma.payout.update({
      where: { id: payout.id },
      data: {
        status: PayoutStatus.PENDING,
        confirmedAt: new Date(),
        confirmationCodeHash: null,
        confirmationCodeExpiresAt: null,
      },
    });

    await this.enqueuePayout(confirmed);
    return confirmed;
  }

  // ── Recurring payouts ────────────────────────────────────────────────────

  async createRecurring(
    merchantId: string,
    dto: CreateRecurringPayoutDto,
  ): Promise<RecurringPayout> {
    const finalDto = await this.resolveRecipientDetails(merchantId, dto);
    const startsAt = dto.startsAt ?? this.nextRunAfter(new Date(), dto.frequency);

    const recurring = await this.prisma.recurringPayout.create({
      data: {
        merchantId,
        recipientId: dto.recipientId ?? null,
        recipientName: finalDto.recipientName,
        destinationType: finalDto.destinationType as DestType,
        destination: finalDto.destination as Prisma.InputJsonValue,
        amount: dto.amount,
        currency: dto.currency,
        frequency: dto.frequency as RecurringPayoutFrequency,
        nextRunAt: startsAt,
      },
    });

    await this.enqueueRecurringPayout(recurring);
    return recurring;
  }

  async listRecurring(merchantId: string): Promise<RecurringPayout[]> {
    return this.prisma.recurringPayout.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getRecurring(
    id: string,
    merchantId: string,
  ): Promise<RecurringPayout> {
    const recurring = await this.prisma.recurringPayout.findUnique({
      where: { id },
    });
    if (!recurring || recurring.merchantId !== merchantId) {
      throw new NotFoundException('Recurring payout not found');
    }
    return recurring;
  }

  async updateRecurring(
    id: string,
    merchantId: string,
    dto: UpdateRecurringPayoutDto,
  ): Promise<RecurringPayout> {
    const existing = await this.getRecurring(id, merchantId);
    const finalDto =
      dto.recipientId || dto.destination
        ? await this.resolveRecipientDetails(merchantId, {
            recipientId: dto.recipientId ?? existing.recipientId ?? undefined,
            recipientName: dto.recipientName ?? existing.recipientName,
            destinationType:
              dto.destinationType ?? existing.destinationType,
            destination:
              dto.destination ??
              (existing.destination as unknown as CreatePayoutDto['destination']),
            amount: dto.amount ?? existing.amount.toString(),
            currency: dto.currency ?? existing.currency,
          })
        : null;

    const updated = await this.prisma.recurringPayout.update({
      where: { id },
      data: {
        ...(dto.recipientId !== undefined && {
          recipientId: dto.recipientId,
        }),
        ...(finalDto && { recipientName: finalDto.recipientName }),
        ...(finalDto && {
          destinationType: finalDto.destinationType as DestType,
          destination: finalDto.destination as Prisma.InputJsonValue,
        }),
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.frequency !== undefined && {
          frequency: dto.frequency as RecurringPayoutFrequency,
        }),
        ...(dto.startsAt !== undefined && { nextRunAt: dto.startsAt }),
        ...(dto.active !== undefined && { active: dto.active }),
      },
    });

    await this.removeRecurringPayoutJob(updated.id);
    if (updated.active) {
      await this.enqueueRecurringPayout(updated);
    }

    return updated;
  }

  async deleteRecurring(
    id: string,
    merchantId: string,
  ): Promise<RecurringPayout> {
    const existing = await this.getRecurring(id, merchantId);
    const updated = await this.prisma.recurringPayout.update({
      where: { id: existing.id },
      data: { active: false },
    });
    await this.removeRecurringPayoutJob(existing.id);
    return updated;
  }

  // ── Cancel ────────────────────────────────────────────────────────────────

  async cancel(id: string, merchantId: string): Promise<Payout> {
    const payout = await this.getById(id, merchantId);

    if (
      payout.status !== PayoutStatus.PENDING &&
      payout.status !== PayoutStatus.REQUIRES_CONFIRMATION
    ) {
      throw new BadRequestException(
        `Cannot cancel a payout in ${payout.status} status — only pending payouts can be cancelled`,
      );
    }

    return this.prisma.payout.update({
      where: { id },
      data: { status: PayoutStatus.CANCELLED },
    });
  }

  // ── Retry ─────────────────────────────────────────────────────────────────

  async retry(id: string, merchantId: string): Promise<Payout> {
    const payout = await this.getById(id, merchantId);

    if (payout.status !== PayoutStatus.FAILED) {
      throw new BadRequestException(
        `Cannot retry a payout in ${payout.status} status — only FAILED payouts can be retried`,
      );
    }

    const confirmation = await this.buildConfirmationFields(
      payout.amount.toString(),
    );
    const reset = await this.prisma.payout.update({
      where: { id },
      data: {
        status: confirmation
          ? PayoutStatus.REQUIRES_CONFIRMATION
          : PayoutStatus.PENDING,
        failureReason: null,
        confirmationCodeHash: confirmation?.hash ?? null,
        confirmationCodeExpiresAt: confirmation?.expiresAt ?? null,
      },
    });

    this.webhooks
      .dispatch(
        merchantId,
        'payout.initiated',
        this.webhookPayload(reset) as Prisma.InputJsonValue,
      )
      .catch(() => undefined);

    if (confirmation) {
      await this.sendPayoutConfirmationCode(reset, confirmation.code);
    } else {
      await this.enqueuePayout(reset);
    }

    return reset;
  }

  // ── Internal processing ───────────────────────────────────────────────────

  async processQueuedPayout(payoutId: string): Promise<void> {
    const payout = await this.prisma.payout.findUnique({
      where: { id: payoutId },
    });
    if (!payout) {
      this.logger.warn(`Queued payout ${payoutId} skipped: not found`);
      return;
    }

    if (payout.status !== PayoutStatus.PENDING) {
      this.logger.log(
        `Queued payout ${payout.id} skipped: status is ${payout.status}`,
      );
      return;
    }

    if (payout.scheduledAt && payout.scheduledAt > new Date()) {
      await this.enqueuePayout(payout);
      return;
    }

    await this.processPayout(payout);
  }

  async processQueuedBatch(batchId: string): Promise<void> {
    const payouts = await this.prisma.payout.findMany({
      where: {
        batchId,
        status: PayoutStatus.PENDING,
        OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }],
      },
      orderBy: { createdAt: 'asc' },
    });

    for (const payout of payouts) {
      await this.processQueuedPayout(payout.id);
    }
  }

  async processRecurringPayout(recurringPayoutId: string): Promise<void> {
    const recurring = await this.prisma.recurringPayout.findUnique({
      where: { id: recurringPayoutId },
    });
    if (!recurring || !recurring.active) return;

    const now = new Date();
    const confirmation = await this.buildConfirmationFields(
      recurring.amount.toString(),
    );
    const payout = await this.prisma.payout.create({
      data: {
        merchantId: recurring.merchantId,
        recipientId: recurring.recipientId,
        recipientName: recurring.recipientName,
        destinationType: recurring.destinationType,
        destination: recurring.destination as Prisma.InputJsonValue,
        amount: recurring.amount,
        currency: recurring.currency,
        status: confirmation
          ? PayoutStatus.REQUIRES_CONFIRMATION
          : PayoutStatus.PENDING,
        scheduledAt: now,
        confirmationCodeHash: confirmation?.hash ?? null,
        confirmationCodeExpiresAt: confirmation?.expiresAt ?? null,
        recurringPayoutId: recurring.id,
      },
    });

    await this.prisma.recurringPayout.update({
      where: { id: recurring.id },
      data: {
        lastRunAt: now,
        nextRunAt: this.nextRunAfter(now, recurring.frequency),
      },
    });

    if (confirmation) {
      await this.sendPayoutConfirmationCode(payout, confirmation.code);
    } else {
      await this.enqueuePayout(payout);
    }
  }

  async processDueRecurringPayouts(): Promise<void> {
    const due = await this.prisma.recurringPayout.findMany({
      where: {
        active: true,
        nextRunAt: { lte: new Date() },
      },
      orderBy: { nextRunAt: 'asc' },
      take: 100,
    });

    for (const recurring of due) {
      await this.processRecurringPayout(recurring.id);
    }
  }

  private async processPayout(payout: Payout): Promise<void> {
    const started = await this.startPayoutProcessing(payout.id);
    if (!started) return;

    try {
      const destination = started.destination as Record<string, unknown>;

      const isStellarPayout =
        started.destinationType === DestType.STELLAR ||
        (started.destinationType === DestType.CRYPTO_WALLET &&
          typeof destination.network === 'string' &&
          destination.network.toLowerCase() === 'stellar');

      if (isStellarPayout) {
        await this.processStellarPayout(started, destination);
      }
      // BANK_ACCOUNT and MOBILE_MONEY remain PROCESSING until external system
      // delivers and calls back to update the status.
    } catch (err) {
      const failureReason =
        err instanceof Error ? err.message : 'Processing failed';
      await this.releaseDebitedFunds(started);
      await this.failPayout(started, failureReason);
    }
  }

  private async processStellarPayout(
    payout: Payout,
    destination: Record<string, unknown>,
  ): Promise<void> {
    const destAddress = String(destination.address);
    const destAsset = this.normalizeStellarAsset(destination.asset);
    const sourceAsset = 'native';
    const sourceAmount = payout.amount.toString();
    const sourceSecret = await this.getMerchantPayoutSourceSecret(
      payout.merchantId,
    );

    let txHash: string;

    if (sourceAsset === destAsset) {
      // Same asset (e.g. XLM → XLM) — no conversion needed. A strict-send path
      // query would be rejected by Horizon, so send a direct payment instead.
      txHash = await this.stellar.sendPayment({
        asset: sourceAsset,
        amount: sourceAmount,
        destinationAccount: destAddress,
        sourceSecret,
      });
    } else {
      const { paths } = await this.stellar.findStrictSendPaths({
        sourceAsset,
        sourceAmount,
        destinationAssets: [destAsset],
        destinationAccount: destAddress,
      });

      const bestPath = paths[0];
      // Convert asset objects to the 'native' | 'CODE:issuer' strings parseAsset expects
      const pathStrings: string[] = (bestPath?.path ?? []).map((a) =>
        assetToString(a as AssetObject),
      );
      const destMin = (
        parseFloat(bestPath?.destinationAmount ?? sourceAmount) * 0.99
      ).toFixed(7);

      txHash = await this.stellar.executePathPayment({
        sourceAsset,
        sourceAmount,
        destinationAccount: destAddress,
        destinationAsset: destAsset,
        destinationMinAmount: destMin,
        path: pathStrings,
        sourceSecret,
      });
    }

    const completed = await this.prisma.payout.update({
      where: { id: payout.id },
      data: {
        status: PayoutStatus.COMPLETED,
        completedAt: new Date(),
        stellarTxHash: txHash,
      },
    });

    this.eventsService.emitPayoutStatus(
      payout.merchantId,
      payout.id,
      PayoutStatus.COMPLETED,
      {
        amount: completed.amount.toString(),
        currency: completed.currency,
        stellarTxHash: txHash,
        updatedAt: new Date(),
      },
    );
    void this.notifications
      .notifyPayoutCompleted(payout.merchantId, payout.id, payout.recipientName)
      .catch(() => undefined);

    this.webhooks
      .dispatch(payout.merchantId, 'payout.completed', {
        ...this.webhookPayload(completed),
        stellarTxHash: txHash,
      } as Prisma.InputJsonValue)
      .catch(() => undefined);
  }

  private normalizeStellarAsset(asset: unknown): string {
    if (typeof asset !== 'string' || asset.trim() === '') return 'native';

    const normalized = asset.trim();
    const upper = normalized.toUpperCase();
    if (upper === 'XLM' || normalized.toLowerCase() === 'native') {
      return 'native';
    }
    if (upper === 'USDC') {
      return stellarUsdcAsset(this.config.get<string>('STELLAR_NETWORK'));
    }
    return normalized;
  }

  private async startPayoutProcessing(payoutId: string): Promise<Payout | null> {
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO "MerchantBalance" ("merchantId", "availableAmount", "reservedAmount", "currency", "updatedAt")
        SELECT "merchantId", 0, 0, "currency", NOW()
        FROM "Payout"
        WHERE "id" = ${payoutId}
        ON CONFLICT ("merchantId") DO NOTHING
      `;

      const payout = await tx.payout.findUnique({ where: { id: payoutId } });
      if (!payout || payout.status !== PayoutStatus.PENDING) {
        return { payout: null, failureReason: null };
      }

      const rows = await tx.$queryRaw<
        Array<{
          availableAmount: Prisma.Decimal;
          currency: string;
        }>
      >`
        SELECT "availableAmount", "currency"
        FROM "MerchantBalance"
        WHERE "merchantId" = ${payout.merchantId}
        FOR UPDATE
      `;
      const balance = rows[0];

      if (!balance || balance.currency !== payout.currency) {
        return {
          payout,
          failureReason: `Insufficient balance for ${payout.currency}`,
        };
      }

      if (balance.availableAmount.lt(payout.amount)) {
        return {
          payout,
          failureReason: `Insufficient balance for ${payout.currency}`,
        };
      }

      await tx.merchantBalance.update({
        where: { merchantId: payout.merchantId },
        data: {
          availableAmount: { decrement: payout.amount },
        },
      });
      await tx.merchantLedgerEntry.create({
        data: {
          merchantId: payout.merchantId,
          payoutId: payout.id,
          type: MerchantLedgerEntryType.PAYOUT_DEBIT,
          amount: payout.amount,
          currency: payout.currency,
          description: 'Payout execution debit',
        },
      });

      const started = await tx.payout.update({
        where: { id: payout.id },
        data: { status: PayoutStatus.PROCESSING },
      });
      return { payout: started, failureReason: null };
    });

    if (result.failureReason && result.payout) {
      await this.failPayout(result.payout, result.failureReason);
      return null;
    }

    return result.payout;
  }

  private async releaseDebitedFunds(payout: Payout): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.merchantBalance.update({
        where: { merchantId: payout.merchantId },
        data: { availableAmount: { increment: payout.amount } },
      });
      await tx.merchantLedgerEntry.create({
        data: {
          merchantId: payout.merchantId,
          payoutId: payout.id,
          type: MerchantLedgerEntryType.PAYOUT_RELEASE,
          amount: payout.amount,
          currency: payout.currency,
          description: 'Payout execution funds released after failure',
        },
      });
    });
  }

  private async failPayout(
    payout: Payout,
    failureReason: string,
  ): Promise<void> {
    const failed = await this.prisma.payout.update({
      where: { id: payout.id },
      data: { status: PayoutStatus.FAILED, failureReason },
    });
    this.eventsService.emitPayoutStatus(
      payout.merchantId,
      payout.id,
      PayoutStatus.FAILED,
      {
        amount: failed.amount.toString(),
        currency: failed.currency,
        failureReason,
        updatedAt: new Date(),
      },
    );
    void this.notifications
      .notifyPayoutFailed(
        payout.merchantId,
        payout.id,
        payout.recipientName,
        failureReason,
      )
      .catch(() => undefined);
    this.webhooks
      .dispatch(payout.merchantId, 'payout.failed', {
        ...this.webhookPayload(failed),
        failureReason,
      } as Prisma.InputJsonValue)
      .catch(() => undefined);
    this.logger.error(`Payout ${payout.id} failed: ${failureReason}`);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private formatResponse(payout: Payout) {
    return {
      id: payout.id,
      merchantId: payout.merchantId,
      recipientId: payout.recipientId,
      recipientName: payout.recipientName,
      destinationType: payout.destinationType,
      destination: payout.destination,
      amount: payout.amount.toString(),
      currency: payout.currency,
      status: payout.status,
      stellarTxHash: payout.stellarTxHash,
      scheduledAt: payout.scheduledAt,
      completedAt: payout.completedAt,
      failureReason: payout.failureReason,
      batchId: payout.batchId,
      createdAt: payout.createdAt,
    };
  }

  private webhookPayload(payout: Payout): Record<string, unknown> {
    return {
      payoutId: payout.id,
      recipientName: payout.recipientName,
      amount: payout.amount.toString(),
      currency: payout.currency,
      destinationType: payout.destinationType,
      status: payout.status,
      ...(payout.batchId && { batchId: payout.batchId }),
      ...(payout.stellarTxHash && { stellarTxHash: payout.stellarTxHash }),
      createdAt: payout.createdAt.toISOString(),
    };
  }

  private async enqueuePayout(payout: Payout): Promise<void> {
    const delay = payout.scheduledAt
      ? Math.max(0, payout.scheduledAt.getTime() - Date.now())
      : 0;

    await this.payoutQueue.add(
      EXECUTE_PAYOUT_JOB,
      { payoutId: payout.id },
      {
        jobId: `payout-${payout.id}`,
        delay,
        attempts: 1,
        ...PAYOUT_JOB_CLEANUP,
      },
    );
  }

  private async enqueueBatch(batchId: string): Promise<void> {
    await this.payoutQueue.add(
      EXECUTE_PAYOUT_BATCH_JOB,
      { batchId },
      {
        jobId: `payout-batch-${batchId}`,
        attempts: 1,
        ...PAYOUT_JOB_CLEANUP,
      },
    );
  }

  private async enqueueRecurringPayout(
    recurring: RecurringPayout,
  ): Promise<void> {
    const every = this.frequencyToMilliseconds(recurring.frequency);
    await this.payoutQueue.add(
      GENERATE_RECURRING_PAYOUT_JOB,
      { recurringPayoutId: recurring.id },
      {
        jobId: `recurring-payout-${recurring.id}`,
        repeat: {
          every,
          offset: recurring.nextRunAt.getTime() % every,
          key: this.recurringJobKey(recurring.id),
        },
        attempts: 1,
        ...PAYOUT_JOB_CLEANUP,
      },
    );
  }

  private async removeRecurringPayoutJob(id: string): Promise<void> {
    await this.payoutQueue
      .removeRepeatableByKey(this.recurringJobKey(id))
      .catch(() => undefined);
  }

  private async enqueueRecurringDispatcher(): Promise<void> {
    await this.payoutQueue.add(
      RUN_RECURRING_PAYOUTS_JOB,
      {},
      {
        jobId: 'run-recurring-payouts',
        repeat: {
          every: 30_000,
          key: 'run-recurring-payouts',
        },
        attempts: 1,
        ...PAYOUT_JOB_CLEANUP,
      },
    );
  }

  private async reconcileScheduledPayoutJobs(): Promise<void> {
    const scheduled = await this.prisma.payout.findMany({
      where: {
        status: PayoutStatus.PENDING,
        scheduledAt: { not: null },
      },
    });

    for (const payout of scheduled) {
      await this.enqueuePayout(payout);
    }

    if (scheduled.length > 0) {
      this.logger.log(
        `Reconciled ${scheduled.length} scheduled payout job(s)`,
      );
    }
  }

  private async reconcileRecurringPayoutJobs(): Promise<void> {
    const recurringPayouts = await this.prisma.recurringPayout.findMany({
      where: { active: true },
    });

    for (const recurring of recurringPayouts) {
      await this.enqueueRecurringPayout(recurring);
    }

    if (recurringPayouts.length > 0) {
      this.logger.log(
        `Reconciled ${recurringPayouts.length} recurring payout job(s)`,
      );
    }
  }

  private async resolveRecipientDetails<T extends CreatePayoutDto>(
    merchantId: string,
    dto: T,
  ): Promise<T> {
    if (!dto.recipientId) return dto;

    const recipient = await this.prisma.recipient.findFirst({
      where: { id: dto.recipientId, merchantId },
    });
    if (!recipient) {
      throw new NotFoundException('Recipient not found');
    }

    return {
      ...dto,
      recipientName: recipient.name,
      destinationType: recipient.type,
      destination: recipient.details as unknown as T['destination'],
    };
  }

  private frequencyToMilliseconds(
    frequency: RecurringPayoutFrequency,
  ): number {
    switch (frequency) {
      case RecurringPayoutFrequency.DAILY:
        return 24 * 60 * 60 * 1000;
      case RecurringPayoutFrequency.WEEKLY:
        return 7 * 24 * 60 * 60 * 1000;
      case RecurringPayoutFrequency.BI_WEEKLY:
        return 14 * 24 * 60 * 60 * 1000;
      case RecurringPayoutFrequency.MONTHLY:
        return 30 * 24 * 60 * 60 * 1000;
    }
  }

  private nextRunAfter(
    date: Date,
    frequency: RecurringPayoutFrequency | `${RecurringPayoutFrequency}`,
  ): Date {
    return new Date(date.getTime() + this.frequencyToMilliseconds(
      frequency as RecurringPayoutFrequency,
    ));
  }

  private recurringJobKey(id: string): string {
    return `recurring-payout-${id}`;
  }

  private async buildConfirmationFields(
    amount: string,
  ): Promise<{ code: string; hash: string; expiresAt: Date } | null> {
    const threshold = Number(this.config.get<string>('PAYOUT_2FA_THRESHOLD'));
    if (!Number.isFinite(threshold) || threshold <= 0) return null;
    if (Number(amount) <= threshold) return null;

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    return {
      code,
      hash: await bcrypt.hash(code, 10),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    };
  }

  private async sendPayoutConfirmationCode(
    payout: Payout,
    code: string,
  ): Promise<void> {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: payout.merchantId },
      select: { email: true },
    });
    if (!merchant) return;

    await this.notifications.sendPayoutApprovalCode(merchant.email, {
      code,
      payoutId: payout.id,
      recipientName: payout.recipientName,
      amount: payout.amount.toString(),
      currency: payout.currency,
      expiresInMinutes: 10,
    });
  }

  private async getMerchantPayoutSourceSecret(
    merchantId: string,
  ): Promise<string | undefined> {
    const settlementKey = await this.prisma.merchantSettlementKey.findUnique({
      where: { merchantId },
    });
    if (!settlementKey?.managed) return undefined;

    return this.settlement.decryptSeed(settlementKey);
  }
}
