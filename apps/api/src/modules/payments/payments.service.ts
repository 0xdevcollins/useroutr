import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import {
  PaymentStatus,
  Payment,
  Prisma,
  BankTransferType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events/events.service';
import { QuotesService } from '../quotes/quotes.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { LinksService } from '../links/links.service';
import { CctpService } from '../cctp/cctp.service';
import { getDomain, type DomainEntry } from '../cctp/domains';
import {
  getEvmContracts,
  getUsdcAddress,
  cctpEnvFromStellarNetwork,
} from '../cctp/contracts';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import {
  CCTP_OBSERVE_QUEUE,
  CCTP_OBSERVE_JOB,
  type CctpObserveJobData,
} from './cctp.constants';
import { ethers } from 'ethers';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentFiltersDto } from './dto/payment-filters.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import * as crypto from 'crypto';

interface CheckoutLineItem {
  label: string;
  amount: number;
}

export interface CheckoutPaymentResponse {
  id: string;
  amount: number;
  currency: string;
  status: string;
  merchantName: string;
  merchantLogo?: string;
  description?: string;
  lineItems?: CheckoutLineItem[];
  expiresAt?: string;
  paymentMethods?: string[];
}

export interface CardSessionResponse {
  clientSecret: string;
}

/** EIP-1193-style call payload — what `wagmi.useSendTransaction` consumes. */
interface WalletCallPayload {
  to: string;
  data: string;
  value: '0x0';
  description: string;
}

export interface CryptoSelectResponse {
  quote: {
    id: string;
    fromAmount: string;
    fromAsset: string;
    fromChain: string;
    toAmount: string;
    toAsset: string;
    toChain: string;
    rate: string;
    fee: string;
    feeBps: number;
    expiresAt: string;
    expiresInSeconds: number;
  };
  wallet: {
    chainId: number;
    approve: WalletCallPayload;
    burn: WalletCallPayload;
  };
}

export interface CryptoStatusResponse {
  status: PaymentStatus;
  sourceTxHash: string | null;
  sourceExplorerUrl: string | null;
  attestation: { status: 'pending' | 'complete' } | null;
  destTxHash: string | null;
  destExplorerUrl: string | null;
  error: string | null;
}

/**
 * ERC-20 approve encoder. Module-level so we don't reconstruct an
 * ethers.Interface on every call.
 */
const APPROVE_INTERFACE = new ethers.Interface([
  'function approve(address spender, uint256 amount)',
]);

type PaymentWithRelations = Payment & {
  merchant: {
    id: string;
    name: string;
    webhookUrl: string | null;
  };
  // Nullable for link-initiated payments that haven't been quoted yet.
  // Callers that need quote fields must null-check first.
  quote: {
    id: string;
    fromAsset: string;
    fromAmount: Prisma.Decimal | number;
    toAsset: string;
    toAmount: Prisma.Decimal | number;
    rate: Prisma.Decimal | number;
    feeAmount: Prisma.Decimal | number;
    expiresAt: Date;
  } | null;
};

@Injectable()
export class PaymentsService implements OnModuleInit {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly CHECKOUT_URL =
    process.env.CHECKOUT_URL || 'https://checkout.useroutr.com';
  private readonly BANK_SESSION_TTL_HOURS = Number(
    process.env.BANK_SESSION_TTL_HOURS || 24,
  );
  private readonly stripe: Stripe | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsService: EventsService,
    private readonly quotesService: QuotesService,
    private readonly webhooksService: WebhooksService,
    private readonly linksService: LinksService,
    private readonly cctpService: CctpService,
    @InjectQueue(CCTP_OBSERVE_QUEUE) private readonly cctpQueue: Queue,
    private readonly configService: ConfigService,
  ) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    this.stripe = secretKey ? new Stripe(secretKey) : null;
  }

  async getById(id: string): Promise<Payment> {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
    });
    if (!payment) throw new NotFoundException(`Payment ${id} not found`);
    return payment;
  }

  async findById(id: string): Promise<Payment | null> {
    return await this.prisma.payment.findUnique({ where: { id } });
  }

  async updateStatus(
    id: string,
    status: PaymentStatus,
    extra: Prisma.PaymentUncheckedUpdateInput = {},
  ): Promise<Payment> {
    this.logger.log(`Updating payment ${id} status to ${status}`);

    const updatedPayment = await this.prisma.payment.update({
      where: { id },
      data: {
        status,
        ...extra,
        ...(status === PaymentStatus.COMPLETED
          ? { completedAt: new Date() }
          : {}),
      },
    });

    if (this.eventsService) {
      this.eventsService.emitPaymentStatus(
        id,
        updatedPayment.merchantId,
        status,
        {
          sourceTxHash: updatedPayment.sourceTxHash || undefined,
          stellarTxHash: updatedPayment.stellarTxHash || undefined,
          destAmount: updatedPayment.destAmount?.toString(),
          destAsset: updatedPayment.destAsset,
          updatedAt: updatedPayment.updatedAt,
        },
      );
    }

    await this.webhooksService.dispatch(
      updatedPayment.merchantId,
      `payment.${status.toLowerCase()}` as import('../webhooks/webhooks.constants').WebhookEventType,
      updatedPayment as unknown as import('@prisma/client').Prisma.InputJsonValue,
      updatedPayment.id,
    );

    return updatedPayment;
  }

  async findExpiredLocked(): Promise<Payment[]> {
    const now = new Date();
    return await this.prisma.payment.findMany({
      where: {
        status: {
          in: [PaymentStatus.SOURCE_LOCKED, PaymentStatus.STELLAR_LOCKED],
        },
        OR: [
          { expiresAt: { lt: now } },
          {
            expiresAt: null,
            createdAt: { lt: new Date(now.getTime() - 2 * 3600 * 1000) },
          },
        ],
      },
    });
  }

  onModuleInit() {
    this.logger.log('PaymentsService initialized. Starting expiry monitor.');
    setInterval(() => {
      void this.processExpiredPending();
      void this.processExpiredBankSessions();
    }, 60_000);
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

  async processExpiredBankSessions() {
    try {
      const now = new Date();
      const expired = await this.prisma.bankSession.findMany({
        where: {
          expiresAt: { lt: now },
        },
        select: { id: true },
      });

      if (expired.length > 0) {
        this.logger.log(`Found ${expired.length} expired bank sessions.`);
      }
    } catch (err) {
      this.logger.error(
        `Failed to scan expired bank sessions: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ── Payment creation ──────────────────────────────────────────────────

  async create(
    merchantId: string,
    dto: CreatePaymentDto,
    idempotencyKey?: string,
  ): Promise<PaymentResponseDto> {
    this.logger.log(
      `Creating payment for merchant ${merchantId} with quote ${dto.quoteId}`,
    );

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

    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
    });
    if (!merchant) throw new NotFoundException('Merchant not found');

    const quote = await this.quotesService.validateAndConsume(dto.quoteId);

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
        idempotencyKey,
        metadata: (dto.metadata as Prisma.InputJsonValue) ?? {},
      },
    });

    return this.formatPaymentResponse(payment);
  }

  // ── Public link-initiated payment creation ────────────────────────────

  /**
   * Create a payment record from a public payment link. Called by the hosted
   * checkout when a customer clicks "Pay" on `/l/{shortCode}` — the customer
   * has no merchant credentials, so the shortCode is the only thing that
   * authorizes the call.
   *
   * The resulting Payment has no quote and no source fields yet. Those get
   * filled in on the method picker (`/{paymentId}` in the checkout app)
   * when the customer chooses card / crypto / bank.
   *
   * For open-amount links (`link.amount === null`), `opts.amount` is
   * required. For fixed-amount links, `opts.amount` is ignored if provided.
   *
   * Atomically marks the link used via `LinksService.markUsed`. If the link
   * is single-use and was already consumed, the payment row is created
   * first then deleted before throwing — so the caller never sees a half-
   * created payment.
   */
  async createFromLink(
    shortCode: string,
    opts: { amount?: number } = {},
  ): Promise<{ id: string }> {
    this.logger.log(`Creating link-initiated payment for shortCode=${shortCode}`);

    // `resolve` enforces 404 (no link), 410 (inactive/expired/exhausted)
    // and increments viewCount as a side-effect. That side-effect is
    // intentional — the customer DID view the link to get here.
    const link = await this.linksService.resolve(shortCode);

    // Pull internal fields (linkId, merchantId, settlement details) — these
    // aren't exposed on the public `resolve` payload.
    const internal = await this.prisma.paymentLink.findUnique({
      where: { shortCode },
      include: {
        merchant: {
          select: {
            id: true,
            settlementAsset: true,
            settlementChain: true,
            settlementAddress: true,
          },
        },
      },
    });
    if (!internal) throw new NotFoundException('Payment link not found');

    // Resolve the amount: fixed links override any caller-supplied value;
    // open-amount links require one.
    let destAmount: Prisma.Decimal | null = null;
    if (link.amount !== null) {
      destAmount = new Prisma.Decimal(link.amount);
    } else if (typeof opts.amount === 'number' && opts.amount > 0) {
      destAmount = new Prisma.Decimal(opts.amount);
    } else {
      throw new BadRequestException(
        'This payment link requires an amount to be supplied.',
      );
    }

    const payment = await this.prisma.payment.create({
      data: {
        merchantId: internal.merchant.id,
        status: PaymentStatus.PENDING,
        // Source fields stay null until the customer picks a method.
        // Quote stays null too — created when the method is chosen.
        destChain: internal.merchant.settlementChain,
        destAsset: internal.merchant.settlementAsset,
        destAmount,
        destAddress: internal.merchant.settlementAddress ?? 'system_vault',
        linkId: internal.id,
        // 30-minute window for the customer to finish the flow. Beyond this
        // the expiry monitor flips status to EXPIRED.
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    // Atomic single-use enforcement. If a parallel customer claimed this
    // single-use link first, undo the payment row and surface the conflict.
    try {
      await this.linksService.markUsed(internal.id, payment.id);
    } catch (err) {
      await this.prisma.payment.delete({ where: { id: payment.id } }).catch(() => {
        // Best-effort cleanup — the payment is meaningless without the link.
        // Don't mask the underlying conflict by throwing the cleanup error.
      });
      throw err;
    }

    return { id: payment.id };
  }

  // ── Crypto pay flow (CCTP V2, EVM → Stellar) ─────────────────────────

  /**
   * Step 1 of the customer crypto flow. The customer has landed on
   * `/[paymentId]/crypto`, picked a source chain, and clicked "Lock quote."
   * This method:
   *
   *   1. Validates the chain is enabled in our CCTP V2 router
   *   2. Validates the merchant has a Stellar settlement address (mint
   *      destination must be real — no `system_vault` placeholder)
   *   3. Creates a Quote sized to `payment.destAmount`
   *   4. Patches Payment to QUOTE_LOCKED + writes source fields + quoteId
   *   5. Builds the wallet-signable approve + burn payloads via
   *      `CctpService.prepareBurn` + an inline ERC-20 approve encoder
   *
   * Idempotent: if called again with the same `sourceChain` while already
   * in QUOTE_LOCKED, returns the existing quote and rebuilds the wallet
   * payload (the on-chain calldata is deterministic for the same args).
   */
  async selectCrypto(
    paymentId: string,
    sourceChain: string,
  ): Promise<CryptoSelectResponse> {
    this.logger.log(
      `Selecting crypto chain=${sourceChain} for payment ${paymentId}`,
    );

    const source = getDomain(sourceChain);
    if (!source || !source.enabled) {
      throw new BadRequestException(
        `Source chain ${sourceChain} is not enabled for CCTP V2`,
      );
    }
    if (source.kind !== 'evm') {
      throw new BadRequestException(
        `Only EVM source chains are supported in v1; got ${source.kind}`,
      );
    }

    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { merchant: true, quote: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    if (
      payment.status !== PaymentStatus.PENDING &&
      payment.status !== PaymentStatus.QUOTE_LOCKED
    ) {
      throw new ConflictException(
        `Payment is in status ${payment.status}; cannot select method`,
      );
    }

    if (!payment.destAmount) {
      throw new BadRequestException(
        'Payment has no destination amount yet. For open-amount links the customer must enter one before picking a method.',
      );
    }

    // Mint recipient is the merchant's Stellar address. Refuse to build a
    // burn payload if it isn't a real G... — the Forwarder Service mint
    // would fail downstream and the customer's USDC would be stuck pending
    // an awkward refund.
    const recipient = payment.merchant.settlementAddress ?? '';
    if (!recipient.startsWith('G') || recipient.length !== 56) {
      throw new BadGatewayException(
        'Merchant has not configured a Stellar settlement address yet. Crypto pay is unavailable for this merchant.',
      );
    }

    // Reuse an existing quote when retrying with the same chain — no point
    // burning a new Redis lock per refresh.
    const existingQuote = payment.quote;
    const needsNewQuote =
      !existingQuote ||
      existingQuote.fromChain !== sourceChain ||
      existingQuote.expiresAt.getTime() < Date.now();

    let quote: NonNullable<typeof existingQuote>;
    if (needsNewQuote) {
      const newQuote = await this.quotesService.createQuote(
        {
          fromChain: sourceChain as never,
          fromAsset: 'USDC',
          fromAmount: payment.destAmount.toString(),
        },
        payment.merchantId,
      );
      // Re-fetch the underlying Quote row to get expiresAt as a Date.
      const refreshed = await this.prisma.quote.findUnique({
        where: { id: newQuote.id },
      });
      if (!refreshed) {
        throw new Error('Quote vanished between create and fetch');
      }
      quote = refreshed;

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          quoteId: quote.id,
          sourceChain: sourceChain,
          sourceAsset: 'USDC',
          sourceAmount: quote.fromAmount,
          status: PaymentStatus.QUOTE_LOCKED,
        },
      });
    } else {
      quote = existingQuote!;
    }

    // Build the wallet payload. CctpService handles burn calldata + hook
    // data; approve is a one-liner ERC-20.
    const env = cctpEnvFromStellarNetwork(
      this.configService.get<string>('STELLAR_NETWORK'),
    );
    const evmContracts = getEvmContracts(sourceChain, env);
    const usdcAddress = getUsdcAddress(sourceChain, env);
    const amountSubunits = this.toUsdcSubunits(quote.fromAmount);

    const approveCalldata = APPROVE_INTERFACE.encodeFunctionData('approve', [
      evmContracts.tokenMessenger,
      amountSubunits,
    ]);

    const burnPayload = await this.cctpService.prepareBurn({
      fromChain: sourceChain,
      toChain: 'stellar',
      amount: amountSubunits,
      recipient,
      speed: 'fast',
      mintMode: 'forwarder',
      maxFee: 0n,
    });
    if ('xdr' in burnPayload) {
      throw new Error('Unexpected Stellar payload for EVM source');
    }

    return {
      quote: {
        id: quote.id,
        fromAmount: quote.fromAmount.toString(),
        fromAsset: quote.fromAsset,
        fromChain: quote.fromChain,
        toAmount: quote.toAmount.toString(),
        toAsset: quote.toAsset,
        toChain: quote.toChain,
        rate: quote.rate.toString(),
        fee: quote.feeAmount.toString(),
        feeBps: quote.feeBps,
        expiresAt: quote.expiresAt.toISOString(),
        expiresInSeconds: Math.max(
          0,
          Math.floor((quote.expiresAt.getTime() - Date.now()) / 1000),
        ),
      },
      wallet: {
        chainId: this.chainIdForEvmDomain(source),
        approve: {
          to: usdcAddress,
          data: approveCalldata,
          value: '0x0',
          description: `Approve ${quote.fromAmount.toString()} USDC for transfer`,
        },
        burn: {
          to: burnPayload.to,
          data: burnPayload.data,
          value: burnPayload.value,
          description: burnPayload.description,
        },
      },
    };
  }

  /**
   * Step 2 of the customer crypto flow. The customer has signed both the
   * approve and the burn tx in their wallet; we record the source tx hash
   * and transition the payment to SOURCE_LOCKED. In PR 7.8b this will
   * also enqueue a `cctp.observe` BullMQ job that polls Iris for the
   * attestation; for now (PR 7.8a) we just record the hash and the worker
   * lands as the next slice.
   *
   * Idempotent on `(paymentId, sourceTxHash)`. A retry with a *different*
   * hash is rejected — that suggests a double-burn, which is rare and
   * the customer should contact support.
   */
  async submitBurn(
    paymentId: string,
    sourceTxHash: string,
  ): Promise<{ status: PaymentStatus; sourceTxHash: string }> {
    this.logger.log(`Burn submitted for ${paymentId} tx=${sourceTxHash}`);

    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    // Idempotency: same tx hash, same state → return current state
    if (
      payment.status === PaymentStatus.SOURCE_LOCKED &&
      payment.sourceTxHash === sourceTxHash
    ) {
      return { status: payment.status, sourceTxHash };
    }

    if (payment.status !== PaymentStatus.QUOTE_LOCKED) {
      throw new ConflictException(
        `Payment is in status ${payment.status}; expected QUOTE_LOCKED to accept burn`,
      );
    }

    // Sanity: if a different tx hash was already recorded, refuse — this
    // is a double-submit and could mean a duplicate burn. Surface loudly.
    if (payment.sourceTxHash && payment.sourceTxHash !== sourceTxHash) {
      throw new ConflictException(
        'A different source tx hash is already recorded for this payment. Contact support.',
      );
    }

    const updated = await this.updateStatus(
      paymentId,
      PaymentStatus.SOURCE_LOCKED,
      { sourceTxHash },
    );

    // Enqueue the CCTP attestation worker. The job runs
    // CctpService.observe (Iris polling, ~8-20s for Fast Transfer) and
    // transitions the payment to PROCESSING → COMPLETED.
    if (!updated.sourceChain) {
      throw new BadRequestException(
        'Payment has no sourceChain recorded — cannot observe a burn without knowing which chain to query.',
      );
    }
    const jobData: CctpObserveJobData = {
      paymentId,
      sourceTxHash,
      sourceChain: updated.sourceChain,
      attempt: 1,
    };
    await this.cctpQueue.add(CCTP_OBSERVE_JOB, jobData, {
      // We manage retries ourselves inside the processor (CCTP_RETRY_DELAYS_MS),
      // so BullMQ shouldn't retry on top of that.
      attempts: 1,
    });

    return { status: updated.status, sourceTxHash };
  }

  /**
   * Status-poll surface for the checkout page. The frontend hits this
   * every 3s once the customer has clicked "Approve & Pay" so it can
   * flip the UI when the payment transitions through SOURCE_LOCKED →
   * PROCESSING → COMPLETED (or FAILED).
   *
   * Returns the absolute minimum the UI needs — never internal fields.
   */
  async getCryptoStatus(paymentId: string): Promise<CryptoStatusResponse> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        status: true,
        sourceChain: true,
        sourceTxHash: true,
        destTxHash: true,
        cctpNonce: true,
        cctpAttestation: true,
        metadata: true,
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    return {
      status: payment.status,
      sourceTxHash: payment.sourceTxHash ?? null,
      sourceExplorerUrl: this.buildExplorerUrl(
        payment.sourceChain,
        payment.sourceTxHash,
      ),
      attestation: payment.cctpAttestation
        ? { status: 'complete' as const }
        : payment.status === PaymentStatus.PROCESSING
          ? { status: 'pending' as const }
          : null,
      destTxHash: payment.destTxHash ?? null,
      destExplorerUrl: this.buildStellarExplorerUrl(payment.destTxHash),
      // Surface cctpError if status=FAILED so frontend can show a useful
      // message instead of a generic "Something went wrong."
      error:
        payment.status === PaymentStatus.FAILED
          ? this.readFailureMessage(payment.metadata)
          : null,
    };
  }

  // ── Crypto helpers ────────────────────────────────────────────────────

  /** USDC has 6 decimals on every EVM chain. */
  private toUsdcSubunits(amount: Prisma.Decimal | string | number): bigint {
    const asDecimal = new Prisma.Decimal(amount.toString());
    const scaled = asDecimal.times(1_000_000);
    return BigInt(scaled.toFixed(0));
  }

  /**
   * Map our internal chain id ('base', 'ethereum', etc.) to the EVM
   * chainId wagmi expects. Stays small — only the enabled chains.
   * Source: https://chainlist.org/
   */
  private chainIdForEvmDomain(domain: DomainEntry): number {
    const env = cctpEnvFromStellarNetwork(
      this.configService.get<string>('STELLAR_NETWORK'),
    );
    const map: Record<string, { mainnet: number; testnet: number }> = {
      ethereum: { mainnet: 1, testnet: 11155111 }, // Sepolia
      avalanche: { mainnet: 43114, testnet: 43113 }, // Fuji
      optimism: { mainnet: 10, testnet: 11155420 }, // OP Sepolia
      arbitrum: { mainnet: 42161, testnet: 421614 }, // Arb Sepolia
      base: { mainnet: 8453, testnet: 84532 }, // Base Sepolia
    };
    const entry = map[domain.id];
    if (!entry) {
      throw new Error(`No chainId mapping for ${domain.id}`);
    }
    return entry[env];
  }

  private buildExplorerUrl(
    chain: string | null,
    txHash: string | null,
  ): string | null {
    if (!chain || !txHash) return null;
    const env = cctpEnvFromStellarNetwork(
      this.configService.get<string>('STELLAR_NETWORK'),
    );
    const map: Record<string, { mainnet: string; testnet: string }> = {
      ethereum: {
        mainnet: 'https://etherscan.io/tx',
        testnet: 'https://sepolia.etherscan.io/tx',
      },
      avalanche: {
        mainnet: 'https://snowtrace.io/tx',
        testnet: 'https://testnet.snowtrace.io/tx',
      },
      optimism: {
        mainnet: 'https://optimistic.etherscan.io/tx',
        testnet: 'https://sepolia-optimism.etherscan.io/tx',
      },
      arbitrum: {
        mainnet: 'https://arbiscan.io/tx',
        testnet: 'https://sepolia.arbiscan.io/tx',
      },
      base: {
        mainnet: 'https://basescan.org/tx',
        testnet: 'https://sepolia.basescan.org/tx',
      },
    };
    const entry = map[chain];
    if (!entry) return null;
    return `${entry[env]}/${txHash}`;
  }

  private buildStellarExplorerUrl(txHash: string | null): string | null {
    if (!txHash) return null;
    const env = cctpEnvFromStellarNetwork(
      this.configService.get<string>('STELLAR_NETWORK'),
    );
    const base =
      env === 'mainnet'
        ? 'https://stellar.expert/explorer/public/tx'
        : 'https://stellar.expert/explorer/testnet/tx';
    return `${base}/${txHash}`;
  }

  private readFailureMessage(metadata: unknown): string | null {
    const rec = this.asRecord(metadata);
    const err = rec.cctpError;
    return typeof err === 'string' ? err : null;
  }

  private formatPaymentResponse(payment: Payment): PaymentResponseDto {
    // Link-initiated payments may have null source/dest amounts before the
    // customer picks a method / enters an open amount. Surface those as 0 /
    // empty rather than crashing the JSON serializer.
    return {
      id: payment.id,
      status: payment.status.toLowerCase(),
      checkout_url: `${this.CHECKOUT_URL}/pay/${payment.id}`,
      amount: payment.sourceAmount ? Number(payment.sourceAmount) : 0,
      currency: payment.sourceAsset ?? '',
      settlement_amount: payment.destAmount?.toString() ?? '0',
      settlement_asset: payment.destAsset,
      metadata: payment.metadata as Record<string, unknown> | null,
      created_at: payment.createdAt,
      expires_at: new Date(payment.createdAt.getTime() + 30 * 60 * 1000),
    };
  }

  private async getByIdWithRelations(
    paymentId: string,
  ): Promise<PaymentWithRelations> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { merchant: true, quote: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment as PaymentWithRelations;
  }

  // ── Checkout ──────────────────────────────────────────────────────────

  async getCheckoutPayment(
    paymentId: string,
  ): Promise<CheckoutPaymentResponse> {
    const payment = await this.getByIdWithRelations(paymentId);
    const metadata = this.asRecord(payment.metadata);
    const description = this.readString(metadata.description);
    const merchantLogo = this.readString(metadata.merchantLogo);
    const lineItems = this.readLineItems(metadata.lineItems);
    // Default to all available methods when the merchant hasn't restricted
    // the list. Link-initiated payments never set this field; SDK callers
    // can pin a subset by passing `metadata.paymentMethods` at create time.
    // Keeping the default here (rather than in the checkout client) ensures
    // every consumer of /v1/checkout/:paymentId sees the same surface.
    const DEFAULT_PAYMENT_METHODS = ['card', 'bank', 'crypto'] as const;
    const paymentMethods = Array.isArray(metadata.paymentMethods)
      ? (metadata.paymentMethods as string[])
      : [...DEFAULT_PAYMENT_METHODS];

    // For link-initiated payments without a method/quote yet, the customer
    // sees the link's destination amount + currency (what the merchant will
    // receive). Once the customer picks a method, sourceAmount/sourceAsset
    // get populated and become authoritative.
    const displayAmount = payment.sourceAmount ?? payment.destAmount;
    const displayAsset = payment.sourceAsset ?? payment.destAsset;

    return {
      id: payment.id,
      amount: displayAmount ? this.toNumber(displayAmount) : 0,
      currency: this.getCardCurrency(displayAsset).toUpperCase(),
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
                amount: displayAmount ? this.toNumber(displayAmount) : 0,
              },
            ],
      // Fall back to the payment's own expiresAt (or 30 min from creation)
      // when there's no quote attached yet.
      expiresAt: (
        payment.quote?.expiresAt ??
        payment.expiresAt ??
        new Date(payment.createdAt.getTime() + 30 * 60 * 1000)
      ).toISOString(),
      paymentMethods,
    };
  }

  async getCheckoutQuote(paymentId: string) {
    const payment = await this.getByIdWithRelations(paymentId);
    const quote = payment.quote;

    if (!quote) {
      // Link-initiated payment whose customer hasn't picked a method yet —
      // there's no quote to return. The checkout app should call this
      // endpoint only after a method has been selected.
      throw new NotFoundException(
        'No quote yet for this payment. Pick a payment method first.',
      );
    }

    return {
      id: quote.id,
      fromAmount: this.toNumber(quote.fromAmount),
      fromCurrency: quote.fromAsset,
      toAmount: this.toNumber(quote.toAmount),
      toCurrency: quote.toAsset,
      rate: this.toNumber(quote.rate),
      fee: this.toNumber(quote.feeAmount),
      expiresAt: quote.expiresAt.toISOString(),
    };
  }

  // ── Card payment (Stripe) ─────────────────────────────────────────────

  async createCardSession(paymentId: string): Promise<CardSessionResponse> {
    if (!this.stripe) {
      throw new ServiceUnavailableException(
        'Stripe is not configured on the API.',
      );
    }

    const payment = await this.getByIdWithRelations(paymentId);

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

    // Link-initiated payments arrive here without source fields populated
    // (they're created pre-method by `createFromLink`). The "Card" choice
    // implies USD via Stripe, sized to the destination amount — pin those
    // values inline so the existing Stripe path can carry on unchanged.
    // SDK-initiated payments already have source fields and skip this step.
    if (!payment.sourceAmount || !payment.sourceAsset) {
      if (!payment.destAmount) {
        throw new BadRequestException(
          'Payment is missing both source and destination amounts. Recreate the payment from a link or supply a quote.',
        );
      }
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          sourceAmount: payment.destAmount,
          sourceAsset: 'USD',
          sourceChain: 'card',
        },
      });
      payment.sourceAmount = payment.destAmount;
      payment.sourceAsset = 'USD';
      payment.sourceChain = 'card';
    }

    const amount = this.toMinorUnits(payment.sourceAmount);
    const currency = this.getCardCurrency(payment.sourceAsset);

    // Wrap the Stripe call so authentication / configuration errors surface
    // as a 503 with a useful message instead of an opaque 500. The
    // GlobalExceptionFilter would otherwise log this as "internal_error"
    // and tell the customer to contact support — for a misconfigured key,
    // the operator needs to see the real Stripe message in the response.
    let paymentIntent: Stripe.PaymentIntent;
    try {
      paymentIntent = await this.stripe.paymentIntents.create({
        amount,
        currency,
        payment_method_types: ['card'],
        metadata: {
          paymentId: payment.id,
          merchantId: payment.merchantId,
        },
        description: `Useroutr checkout payment ${payment.id}`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Stripe paymentIntents.create failed: ${message}`);
      throw new ServiceUnavailableException(`Stripe error: ${message}`);
    }

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

    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );
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
            amount: payment.sourceAmount ? this.toNumber(payment.sourceAmount) : 0,
            currency: this.getCardCurrency(payment.sourceAsset ?? '').toUpperCase(),
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

  // ── Bank transfer session ─────────────────────────────────────────────

  async getOrCreateBankSession(paymentId: string) {
    let payment = await this.getById(paymentId);
    const now = new Date();
    const existing = await this.prisma.bankSession.findUnique({
      where: { paymentId },
    });

    if (existing) {
      if (existing.expiresAt < now) {
        return {
          expired: true,
          session: this.toBankSessionResponse(existing),
        };
      }

      return {
        expired: false,
        session: this.toBankSessionResponse(existing),
      };
    }

    // Same auto-fill pattern as createCardSession: link-initiated payments
    // arrive here without source fields. The bank-transfer choice implies
    // a USD-denominated transfer sized to the destination amount.
    if (!payment.sourceAmount || !payment.sourceAsset) {
      if (!payment.destAmount) {
        throw new BadRequestException(
          'Payment is missing both source and destination amounts.',
        );
      }
      payment = await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          sourceAmount: payment.destAmount,
          sourceAsset: 'USD',
          sourceChain: 'bank',
        },
      });
    }

    const type = this.resolveBankTransferType(payment);
    const reference = await this.createUniqueReference(payment.id);
    const account = this.resolveDestinationAccount(type, payment.id);
    const expiresAt = new Date(
      now.getTime() + this.BANK_SESSION_TTL_HOURS * 60 * 60 * 1000,
    );

    const created = await this.prisma.bankSession.create({
      data: {
        paymentId,
        reference,
        type,
        bankName: account.bankName,
        accountNumber: this.encryptAtRest(account.accountNumber),
        routingNumber: account.routingNumber,
        iban: account.iban,
        bic: account.bic,
        branchCode: account.branchCode,
        // Source fields are guaranteed populated by the auto-fill block above
        // (or were already set on SDK-initiated payments). The `!` documents
        // that invariant for the type checker.
        amount: payment.sourceAmount!,
        currency: payment.sourceAsset!,
        instructions: this.buildInstructions(type),
        expiresAt,
      },
    });

    return {
      expired: false,
      session: this.toBankSessionResponse(created),
    };
  }

  async regenerateBankSession(paymentId: string) {
    const now = new Date();
    const existing = await this.prisma.bankSession.findUnique({
      where: { paymentId },
    });
    if (existing && existing.expiresAt >= now) {
      return {
        expired: false,
        session: this.toBankSessionResponse(existing),
      };
    }

    if (existing) {
      await this.prisma.bankSession.delete({ where: { paymentId } });
    }

    return this.getOrCreateBankSession(paymentId);
  }

  async markBankTransferSent(paymentId: string) {
    const payment = await this.getById(paymentId);
    const session = await this.prisma.bankSession.findUnique({
      where: { paymentId },
    });

    if (!session) {
      throw new BadRequestException(
        'Bank session not found. Create one first.',
      );
    }

    if (session.expiresAt < new Date()) {
      throw new ConflictException(
        'Bank session has expired. Regenerate instructions.',
      );
    }

    if (payment.status === PaymentStatus.AWAITING_CONFIRMATION) {
      throw new ConflictException('Transfer already marked as sent');
    }

    const allowedSentStates: PaymentStatus[] = [
      PaymentStatus.PENDING,
      PaymentStatus.SOURCE_LOCKED,
    ];
    if (!allowedSentStates.includes(payment.status)) {
      throw new ConflictException(
        `Cannot mark transfer sent from status ${payment.status}`,
      );
    }

    return this.updateStatus(payment.id, PaymentStatus.AWAITING_CONFIRMATION);
  }

  async handleBankTransferNotice(payload: {
    reference: string;
    amount: string;
    currency: string;
    transactionId?: string;
  }) {
    const session = await this.prisma.bankSession.findUnique({
      where: { reference: payload.reference },
    });

    if (!session) {
      this.logger.warn(
        `Bank notice unmatched by reference: ${payload.reference}`,
      );
      return { matched: false, reason: 'reference_not_found' as const };
    }

    const payment = await this.getById(session.paymentId);
    const amountMatches = session.amount.toString() === payload.amount;
    const currencyMatches =
      session.currency.toUpperCase() === payload.currency.toUpperCase();

    if (!amountMatches || !currencyMatches) {
      this.logger.warn(
        `Bank notice mismatch for payment ${payment.id}: amount/currency mismatch`,
      );
      return { matched: false, reason: 'amount_or_currency_mismatch' as const };
    }

    if (payment.status === PaymentStatus.COMPLETED) {
      return { matched: true, status: payment.status };
    }

    await this.updateStatus(payment.id, PaymentStatus.PROCESSING, {
      sourceTxHash: payload.transactionId || payment.sourceTxHash,
    });
    const updated = await this.updateStatus(
      payment.id,
      PaymentStatus.COMPLETED,
    );

    return {
      matched: true,
      status: updated.status,
      paymentId: payment.id,
    };
  }

  verifyBankWebhookSecret(secret?: string) {
    const expected = process.env.BANK_WEBHOOK_SECRET;
    if (!expected) {
      this.logger.warn(
        'BANK_WEBHOOK_SECRET is not configured; bank webhook accepts all requests',
      );
      return;
    }

    if (!secret || secret !== expected) {
      throw new UnauthorizedException('Invalid bank webhook secret');
    }
  }

  // ── Common query / lifecycle methods ──────────────────────────────────

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

    const where: Prisma.PaymentWhereInput = { merchantId };
    if (status) where.status = status;
    if (currency) where.sourceAsset = currency;

    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      };
    }

    if (minAmount || maxAmount) {
      where.sourceAmount = {
        ...(minAmount ? { gte: minAmount } : {}),
        ...(maxAmount ? { lte: maxAmount } : {}),
      };
    }

    if (search) {
      where.OR = [{ id: { contains: search, mode: 'insensitive' as const } }];
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

  async findExpiredPending() {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    return this.prisma.payment.findMany({
      where: {
        status: PaymentStatus.PENDING,
        createdAt: { lt: thirtyMinAgo },
      },
    });
  }

  async notifyCompletion(paymentId: string) {
    await this.updateStatus(paymentId, PaymentStatus.COMPLETED);
  }

  async initiateRefund(paymentId: string): Promise<Payment> {
    const payment = await this.getById(paymentId);

    const refundableStatuses: PaymentStatus[] = [
      PaymentStatus.SOURCE_LOCKED,
      PaymentStatus.STELLAR_LOCKED,
      PaymentStatus.PROCESSING,
      PaymentStatus.COMPLETED,
    ];

    if (!refundableStatuses.includes(payment.status)) {
      throw new ConflictException(
        `Payment in status ${payment.status} cannot be refunded`,
      );
    }

    return this.updateStatus(paymentId, PaymentStatus.REFUNDING);
  }

  async exportTransactions(
    merchantId: string,
    filters: PaymentFiltersDto,
  ): Promise<Buffer> {
    const { items } = await this.getByMerchant(merchantId, {
      ...filters,
      limit: 1000,
    });
    const header = 'id,amount,currency,status,createdAt\n';
    const rows = items
      .map(
        (p) =>
          `${p.id},${String(p.sourceAmount)},${p.sourceAsset},${p.status},${p.createdAt.toISOString()}`,
      )
      .join('\n');
    return Buffer.from(header + rows);
  }

  // ── Private helpers ───────────────────────────────────────────────────

  private getCardCurrency(asset: string): string {
    const normalized = asset.trim().toLowerCase();
    return normalized === 'usdc' ? 'usd' : normalized;
  }

  private toMinorUnits(amount: unknown): number {
    const numericAmount = this.toNumber(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      throw new BadRequestException(
        'Payment amount must be greater than zero.',
      );
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

  private resolveBankTransferType(payment: Payment): BankTransferType {
    // Default to ACH when a link-initiated bank-transfer payment hasn't yet
    // recorded a source chain. The customer will refine the choice on the
    // method picker; routing rules pick up automatically.
    const chain = (payment.sourceChain ?? '').toLowerCase();
    if (
      chain.includes('eu') ||
      chain.includes('uk') ||
      chain.includes('sepa')
    ) {
      return BankTransferType.SEPA;
    }
    if (
      chain.includes('ng') ||
      chain.includes('ke') ||
      chain.includes('gh') ||
      chain.includes('za')
    ) {
      return BankTransferType.LOCAL;
    }
    return BankTransferType.ACH;
  }

  private resolveDestinationAccount(type: BankTransferType, paymentId: string) {
    const suffix = paymentId.slice(-4).toUpperCase();
    if (type === BankTransferType.SEPA) {
      return {
        bankName: 'Euro Settlement Bank',
        accountNumber: `DE89370400440532013000`,
        routingNumber: null,
        iban: `DE89370400440532013000`,
        bic: 'COBADEFFXXX',
        branchCode: null,
      };
    }

    if (type === BankTransferType.LOCAL) {
      return {
        bankName: 'First National Local',
        accountNumber: `10345678${suffix}`,
        routingNumber: null,
        iban: null,
        bic: null,
        branchCode: '001',
      };
    }

    return {
      bankName: 'First National',
      accountNumber: `123456${suffix}`,
      routingNumber: '021000021',
      iban: null,
      bic: null,
      branchCode: null,
    };
  }

  private buildInstructions(type: BankTransferType): string {
    if (type === BankTransferType.SEPA) {
      return 'Include the reference exactly as shown. SEPA confirmation may take 1-3 business days.';
    }
    if (type === BankTransferType.LOCAL) {
      return 'Include the reference exactly as shown and use local transfer rails only.';
    }
    return 'Include the reference exactly as shown. ACH confirmation may take 1-3 business days.';
  }

  private async createUniqueReference(paymentId: string) {
    const primary = this.buildReference(paymentId, 0);
    const existing = await this.prisma.bankSession.findUnique({
      where: { reference: primary },
    });
    if (!existing) return primary;

    const fallback = this.buildReference(paymentId, 1);
    const fallbackExisting = await this.prisma.bankSession.findUnique({
      where: { reference: fallback },
    });
    if (!fallbackExisting) return fallback;

    throw new ConflictException('Failed to allocate unique bank reference');
  }

  private buildReference(paymentId: string, retry: number) {
    const input = `${paymentId}:${retry}`;
    const hash = crypto
      .createHash('sha256')
      .update(input)
      .digest('hex')
      .slice(0, 10);
    const base36 = BigInt(`0x${hash}`).toString(36).toUpperCase();
    return `TVP-${base36.slice(0, 8)}`;
  }

  private encryptAtRest(value: string) {
    const key = process.env.BANK_SESSION_ENCRYPTION_KEY;
    if (!key) return value;

    const normalized = crypto.createHash('sha256').update(key).digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', normalized, iv);
    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return `enc:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  private decryptAtRead(value: string) {
    if (!value.startsWith('enc:')) return value;

    const key = process.env.BANK_SESSION_ENCRYPTION_KEY;
    if (!key) {
      throw new ConflictException(
        'Encrypted bank account value cannot be read without encryption key',
      );
    }

    const normalized = crypto.createHash('sha256').update(key).digest();
    const [, ivHex, tagHex, dataHex] = value.split(':');
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      normalized,
      Buffer.from(ivHex, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const clear = Buffer.concat([
      decipher.update(Buffer.from(dataHex, 'hex')),
      decipher.final(),
    ]);
    return clear.toString('utf8');
  }

  private maskAccount(value: string) {
    const visible = value.slice(-4);
    return `****${visible}`;
  }

  private maskIban(value: string | null) {
    if (!value) return null;
    const visible = value.slice(-6);
    return `******${visible}`;
  }

  private toBankSessionResponse(session: {
    bankName: string;
    accountNumber: string;
    routingNumber: string | null;
    iban: string | null;
    bic: string | null;
    branchCode: string | null;
    reference: string;
    amount: Prisma.Decimal | number | string;
    currency: string;
    instructions: string;
    type: BankTransferType;
    expiresAt: Date;
  }) {
    const accountNumber = this.decryptAtRead(session.accountNumber);
    return {
      bankName: session.bankName,
      accountNumber: this.maskAccount(accountNumber),
      routingNumber: session.routingNumber,
      iban: this.maskIban(session.iban),
      bic: session.bic,
      branchCode: session.branchCode,
      reference: session.reference,
      amount: session.amount.toString(),
      currency: session.currency,
      instructions: session.instructions,
      type: session.type,
      expiresAt: session.expiresAt,
    };
  }
}
