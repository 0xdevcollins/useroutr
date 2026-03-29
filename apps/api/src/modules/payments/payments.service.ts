import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PaymentStatus, Payment, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events/events.gateway';
import { QuotesService } from '../quotes/quotes.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { StellarService } from '../stellar/stellar.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentFiltersDto } from './dto/payment-filters.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import * as crypto from 'crypto';

interface CheckoutLineItem {
  label: string;
  amount: number;
}

interface CheckoutPaymentResponse {
  id: string;
  amount: number;
  currency: string;
  status: string;
  merchantName: string;
  merchantLogo?: string;
  description?: string;
  lineItems?: CheckoutLineItem[];
  expiresAt?: string;
}

interface CardSessionResponse {
  clientSecret: string;
}

type PaymentWithRelations = Payment & {
  merchant: {
    id: string;
    name: string;
    webhookUrl: string | null;
  };
  quote: {
    expiresAt: Date;
  };
};

@Injectable()
export class PaymentsService implements OnModuleInit {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly CHECKOUT_URL =
    process.env.CHECKOUT_URL || 'https://checkout.useroutr.io';
  private readonly stripe: Stripe | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
    private readonly quotesService: QuotesService,
    private readonly webhooksService: WebhooksService,
    private readonly stellarService: StellarService,
    private readonly configService: ConfigService,
  ) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    this.stripe = secretKey ? new Stripe(secretKey) : null;
  }

  async onModuleInit() {
    this.logger.log('PaymentsService initialized. Starting expiry monitor.');
    // Simple interval-based expiry check as fallback for missing Scheduler
    setInterval(() => this.processExpiredPending(), 60_000);
  }

  async processExpiredPending() {
    try {
      const expired = await this.findExpiredPending();
      if (expired.length > 0) {
        this.logger.log(
          `Found ${expired.length} expired pending payments. Marking as EXPIRED.`,
        );
        for (const p of expired) {
          await this.updateStatus(p.id, PaymentStatus.EXPIRED);
        }
      }
    } catch (err) {
      this.logger.error(
        `Failed to process expired payments: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async create(
    merchantId: string,
    dto: CreatePaymentDto,
    idempotencyKey?: string,
  ): Promise<PaymentResponseDto> {
    this.logger.log(
      `Creating payment for merchant ${merchantId} with quote ${dto.quoteId}`,
    );

    // Idempotency check
    if (idempotencyKey) {
      const existing = await this.prisma.payment.findUnique({
        where: { idempotencyKey },
      });
      if (existing) {
        this.logger.log(
          `Returning existing payment for idempotency key: ${idempotencyKey}`,
        );
        return this.formatPaymentResponse(existing);
      }
    }

    // Fetch merchant to get settlement preferences
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
    });
    if (!merchant) throw new NotFoundException('Merchant not found');

    // 1. Validate and consume quote
    const quote = await this.quotesService.validateAndConsume(dto.quoteId);

    // 2. Generate HTLC secret + hashlock
    const secret = crypto.randomBytes(32);
    const hashlock = crypto
      .createHash('sha256')
      .update(secret)
      .digest('hex');
    const secretHex = secret.toString('hex');

    // 3. Create payment record (status: PENDING)
    const payment = await this.prisma.payment.create({
      data: {
        merchantId,
        quoteId: quote.id,
        status: PaymentStatus.PENDING,
        sourceChain: quote.fromChain,
        sourceAsset: quote.fromAsset,
        sourceAmount: quote.fromAmount,
        destChain: quote.toChain,
        destAsset: quote.toAsset,
        destAmount: quote.toAmount,
        destAddress: merchant.settlementAddress || 'system_vault',
        hashlock,
        htlcSecret: secretHex,
        idempotencyKey,
        metadata: (dto.metadata as any) || {},
      },
    });

    // 4. Return payment
    return this.formatPaymentResponse(payment);
  }

  private formatPaymentResponse(payment: Payment): PaymentResponseDto {
    return {
      id: payment.id,
      status: payment.status.toLowerCase(),
      checkout_url: `${this.CHECKOUT_URL}/pay/${payment.id}`,
      amount: Number(payment.sourceAmount),
      currency: payment.sourceAsset,
      settlement_amount: payment.destAmount.toString(),
      settlement_asset: payment.destAsset,
      metadata: payment.metadata,
      created_at: payment.createdAt,
      expires_at: new Date(payment.createdAt.getTime() + 30 * 60 * 1000),
    };
  }

  async updateStatus(
    paymentId: string,
    status: PaymentStatus,
    extra?: Record<string, unknown>,
  ): Promise<Payment> {
    this.logger.log(`Updating payment ${paymentId} status to ${status}`);

    const payment = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status,
        ...extra,
        ...(status === PaymentStatus.COMPLETED
          ? { completedAt: new Date() }
          : {}),
      } as any,
    });

    // Emit WebSocket event
    if (this.eventsGateway.server) {
      this.eventsGateway.server.to(payment.id).emit('payment.updated', payment);
    }

    // Dispatch webhook
    await this.webhooksService.dispatch(
      payment.merchantId,
      `payment.${status.toLowerCase()}`,
      payment,
      payment.id,
    );

    return payment;
  }

  async getById(paymentId: string): Promise<PaymentWithRelations> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { merchant: true, quote: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment as PaymentWithRelations;
  }

  async getCheckoutPayment(paymentId: string): Promise<CheckoutPaymentResponse> {
    const payment = await this.getById(paymentId);
    const metadata = this.asRecord(payment.metadata);
    const description = this.readString(metadata.description);
    const merchantLogo = this.readString(metadata.merchantLogo);
    const lineItems = this.readLineItems(metadata.lineItems);

    return {
      id: payment.id,
      amount: this.toNumber(payment.sourceAmount),
      currency: this.getCardCurrency(payment.sourceAsset).toUpperCase(),
      status: payment.status,
      merchantName: payment.merchant.name,
      merchantLogo: merchantLogo ?? undefined,
      description: description ?? undefined,
      lineItems:
        lineItems.length > 0
          ? lineItems
          : [
              {
                label: description ?? 'Payment total',
                amount: this.toNumber(payment.sourceAmount),
              },
            ],
      expiresAt: payment.quote.expiresAt.toISOString(),
    };
  }

  async createCardSession(paymentId: string): Promise<CardSessionResponse> {
    if (!this.stripe) {
      throw new ServiceUnavailableException(
        'Stripe is not configured on the API.',
      );
    }

    const payment = await this.getById(paymentId);

    if (
      payment.status === PaymentStatus.COMPLETED ||
      payment.status === PaymentStatus.REFUNDED
    ) {
      throw new ConflictException(
        `Payment ${payment.id} can no longer accept card sessions.`,
      );
    }

    if (payment.status === PaymentStatus.EXPIRED) {
      throw new ConflictException(`Payment ${payment.id} has expired.`);
    }

    const amount = this.toMinorUnits(payment.sourceAmount);
    const currency = this.getCardCurrency(payment.sourceAsset);

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount,
      currency,
      payment_method_types: ['card'],
      metadata: {
        paymentId: payment.id,
        merchantId: payment.merchantId,
      },
      description: `Tavvio checkout payment ${payment.id}`,
    });

    if (!paymentIntent.client_secret) {
      throw new ServiceUnavailableException(
        'Stripe did not return a client secret for this payment.',
      );
    }

    const nextStatus: PaymentStatus =
      payment.status === PaymentStatus.FAILED
        ? PaymentStatus.PENDING
        : payment.status;

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: nextStatus,
        metadata: this.mergeMetadata(payment.metadata, {
          paymentMethod: 'card',
          stripe: {
            paymentIntentId: paymentIntent.id,
            clientSecretIssuedAt: new Date().toISOString(),
            currency,
          },
        }),
      },
    });

    return {
      clientSecret: paymentIntent.client_secret,
    };
  }

  async handleStripeWebhook(
    signature: string | undefined,
    rawBody: Buffer | undefined,
  ): Promise<void> {
    if (!this.stripe) {
      throw new ServiceUnavailableException(
        'Stripe is not configured on the API.',
      );
    }

    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new ServiceUnavailableException(
        'Stripe webhook secret is not configured on the API.',
      );
    }

    if (!signature || !rawBody) {
      throw new BadRequestException('Missing Stripe signature or raw body.');
    }

    const event = this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret,
    );

    if (event.type === 'payment_intent.succeeded') {
      await this.handlePaymentIntentSucceeded(event);
      return;
    }

    if (event.type === 'payment_intent.payment_failed') {
      await this.handlePaymentIntentFailed(event);
    }
  }

  async getByMerchant(merchantId: string, filters: PaymentFiltersDto) {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status,
      search,
      from,
      to,
      currency,
      minAmount,
      maxAmount,
    } = filters;

    const skip = (Number(page) - 1) * Number(limit);

    const where: any = { merchantId };
    if (status) where.status = status;
    if (currency) where.sourceAsset = currency;

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    if (minAmount || maxAmount) {
      where.sourceAmount = {};
      if (minAmount) where.sourceAmount.gte = minAmount;
      if (maxAmount) where.sourceAmount.lte = maxAmount;
    }

    if (search) {
      where.OR = [{ id: { contains: search, mode: 'insensitive' } }];
    }

    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  }

  async findByStellarLockId(lockId: string) {
    return this.prisma.payment.findFirst({
      where: { stellarLockId: lockId },
    });
  }

  async findBySourceLockId(lockId: string) {
    return this.prisma.payment.findFirst({
      where: { sourceLockId: lockId },
    });
  }

  async findExpiredPending() {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    return this.prisma.payment.findMany({
      where: {
        status: PaymentStatus.PENDING,
        createdAt: { lt: thirtyMinAgo },
      },
    });
  }

  async handleSourceLock(
    paymentId: string,
    sourceTxHash: string,
    sourceLockId: string,
  ) {
    const payment = await this.getById(paymentId);
    if (payment.status !== PaymentStatus.PENDING) return;

    await this.updateStatus(paymentId, PaymentStatus.SOURCE_LOCKED, {
      sourceTxHash,
      sourceLockId,
    });

    await this.lockOnStellar(paymentId);
  }

  async lockOnStellar(paymentId: string) {
    const payment = await this.getById(paymentId);

    try {
      const stellarTxHash = await this.stellarService.lockHTLC({
        sender: 'vault_address',
        receiver: payment.destAddress,
        token: payment.destAsset,
        amount: BigInt(Math.floor(Number(payment.destAmount))),
        hashlock: payment.hashlock!,
        timelock: Math.floor(Date.now() / 1000) + 3600,
      });

      await this.updateStatus(paymentId, PaymentStatus.STELLAR_LOCKED, {
        stellarTxHash,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Stellar lock failed for payment ${paymentId}: ${message}`,
      );
      await this.updateStatus(paymentId, PaymentStatus.FAILED);
    }
  }

  async notifyCompletion(paymentId: string) {
    await this.updateStatus(paymentId, PaymentStatus.COMPLETED);
  }

  private async handlePaymentIntentSucceeded(event: Stripe.Event) {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const paymentId = paymentIntent.metadata.paymentId;

    if (!paymentId) {
      this.logger.warn(
        `Stripe event ${event.id} is missing paymentId metadata; skipping.`,
      );
      return;
    }

    const payment = await this.getById(paymentId);
    const updatedMetadata = this.mergeMetadata(payment.metadata, {
      paymentMethod: 'card',
      stripe: {
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
        eventId: event.id,
        succeededAt: new Date().toISOString(),
      },
    });

    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.COMPLETED,
          completedAt: new Date(),
          metadata: updatedMetadata,
        },
      }),
      this.prisma.webhookEvent.create({
        data: {
          merchantId: payment.merchantId,
          paymentId: payment.id,
          eventType: 'payment.completed',
          payload: {
            paymentId: payment.id,
            merchantId: payment.merchantId,
            amount: this.toNumber(payment.sourceAmount),
            currency: this.getCardCurrency(payment.sourceAsset).toUpperCase(),
            provider: 'stripe',
            stripePaymentIntentId: paymentIntent.id,
            settlementStatus: 'queued',
          } as Prisma.InputJsonValue,
        },
      }),
    ]);
  }

  private async handlePaymentIntentFailed(event: Stripe.Event) {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const paymentId = paymentIntent.metadata.paymentId;

    if (!paymentId) {
      this.logger.warn(
        `Stripe event ${event.id} is missing paymentId metadata; skipping.`,
      );
      return;
    }

    const payment = await this.getById(paymentId);

    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          metadata: this.mergeMetadata(payment.metadata, {
            paymentMethod: 'card',
            stripe: {
              paymentIntentId: paymentIntent.id,
              status: paymentIntent.status,
              eventId: event.id,
              failedAt: new Date().toISOString(),
              lastError:
                paymentIntent.last_payment_error?.message ??
                'Card payment failed',
            },
          }),
        },
      }),
      this.prisma.webhookEvent.create({
        data: {
          merchantId: payment.merchantId,
          paymentId: payment.id,
          eventType: 'payment.failed',
          payload: {
            paymentId: payment.id,
            merchantId: payment.merchantId,
            provider: 'stripe',
            stripePaymentIntentId: paymentIntent.id,
            reason:
              paymentIntent.last_payment_error?.message ??
              'Card payment failed',
          } as Prisma.InputJsonValue,
        },
      }),
    ]);
  }

  private getCardCurrency(asset: string): string {
    const normalized = asset.trim().toLowerCase();
    return normalized === 'usdc' ? 'usd' : normalized;
  }

  private toMinorUnits(amount: unknown): number {
    const numericAmount = this.toNumber(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero.');
    }

    return Math.max(1, Math.round(numericAmount * 100));
  }

  private toNumber(value: unknown): number {
    const numeric = typeof value === 'number' ? value : Number(String(value));
    if (!Number.isFinite(numeric)) {
      throw new BadRequestException('Payment amount is invalid.');
    }
    return numeric;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }

  private readString(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
  }

  private readLineItems(value: unknown): CheckoutLineItem[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.flatMap((entry) => {
      if (!entry || typeof entry !== 'object') {
        return [];
      }

      const record = entry as Record<string, unknown>;
      const label = this.readString(record.label);
      const amount = Number(record.amount);

      if (!label || !Number.isFinite(amount)) {
        return [];
      }

      return [{ label, amount }];
    });
  }

  private mergeMetadata(
    current: unknown,
    patch: Record<string, unknown>,
  ): Prisma.InputJsonValue {
    return {
      ...this.asRecord(current),
      ...patch,
    } as Prisma.InputJsonValue;
  }
}
