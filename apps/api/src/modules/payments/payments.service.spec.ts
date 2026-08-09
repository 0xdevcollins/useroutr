import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events/events.service';
import { QuotesService } from '../quotes/quotes.service';
import { StellarService } from '../stellar/stellar.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { LinksService } from '../links/links.service';
import { CctpService } from '../cctp/cctp.service';
import { BurnFeeService } from '../cctp/burn-fee.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EscrowService } from '../escrow/escrow.service';

interface MockPayment {
  id: string;
  merchantId: string;
  status: string;
  sourceAmount: string;
  sourceAsset: string;
  metadata: Record<string, unknown>;
  completedAt: Date | null;
  merchant: { id: string; name: string; webhookUrl: string };
  quote: { expiresAt: Date };
}

describe('PaymentsService', () => {
  let service: PaymentsService;

  const paymentRecord: MockPayment = {
    id: 'pay_123',
    merchantId: 'merchant_123',
    status: 'PENDING',
    sourceAmount: '50',
    sourceAsset: 'USD',
    metadata: {},
    completedAt: null,
    merchant: {
      id: 'merchant_123',
      name: 'Acme Store',
      webhookUrl: 'https://merchant.test/webhook',
    },
    quote: {
      expiresAt: new Date('2026-03-28T12:00:00Z'),
    },
  };

  const prisma = {
    payment: {
      updateMany: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      // createFromLink wires both — `create` lands the row, `delete` is the
      // best-effort rollback if `markUsed` loses the single-use race.
      create: jest.fn(),
      delete: jest.fn(),
    },
    paymentLink: {
      findUnique: jest.fn(),
    },
    webhookEvent: {
      create: jest.fn(),
    },
    merchant: {
      findUnique: jest.fn(),
    },
    quote: {
      findUnique: jest.fn(),
    },
    merchantBalance: {
      upsert: jest.fn(),
      update: jest.fn(),
    },
    merchantLedgerEntry: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const eventsService = {
    emitPaymentStatus: jest.fn(),
  };

  const quotesService = {
    validateAndConsume: jest.fn(),
    createQuote: jest.fn(),
  };

  const stellarService = {
    verifyIncomingPayment: jest.fn(),
  };

  const webhooksService = {
    dispatch: jest.fn(),
  };

  // LinksService double — hoisted out of the test module so individual tests
  // can mock per-call behavior (resolve returns a link, markUsed throws on
  // race, etc.).
  const linksService = {
    resolve: jest.fn(),
    markUsed: jest.fn(),
  };

  // CctpService double — only `prepareBurn` is touched by the crypto-pay
  // path; other entry points (observe, listSupportedRoutes) aren't reached
  // from PaymentsService in this test suite.
  const cctpService = {
    prepareBurn: jest.fn(),
  };

  // Circle's fee lookup. Defaults to the real Ethereum → Stellar answer (1 bp)
  // so selectCrypto takes the Fast Transfer path these tests describe; a test
  // that wants the standard-finality fallback can resolve null instead.
  const burnFeeService = {
    minimumFeeBps: jest.fn().mockResolvedValue(1),
    maxFeeFor: jest.fn((amount: bigint, bps: number) => {
      if (bps <= 0) return 0n;
      const n = amount * BigInt(bps);
      const r = n / 10_000n + (n % 10_000n ? 1n : 0n);
      return r > 0n ? r : 1n;
    }),
  };

  // BullMQ queue double — submitBurn enqueues a cctp.observe job after
  // recording the source tx hash. Tests assert the call was made; the
  // worker itself is exercised by its own spec.
  const cctpQueue = {
    add: jest.fn(),
  };

  const holdQueue = {
    add: jest.fn(),
    remove: jest.fn().mockResolvedValue(undefined),
  };

  const escrowService = {
    autoRelease: jest.fn(),
    buildLockTransaction: jest.fn(),
    computeEscrowId: jest.fn().mockResolvedValue('a1b2c3'),
    getEscrow: jest.fn(),
    isConfigured: jest.fn().mockReturnValue(true),
  };

  const configService = {
    // Typed explicitly: inferring from the default implementation narrows the
    // return to 'whsec_test' | undefined, and any describe that overrides it
    // with another key then fails to typecheck.
    get: jest.fn<string | undefined, [string]>((key: string) => {
      if (key === 'STRIPE_WEBHOOK_SECRET') return 'whsec_test';
      return undefined;
    }),
  };

  let stripeMock: {
    paymentIntents: { create: jest.Mock };
    webhooks: { constructEvent: jest.Mock };
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    prisma.payment.findUnique.mockResolvedValue(paymentRecord);
    prisma.payment.update.mockResolvedValue(paymentRecord);
    prisma.webhookEvent.create.mockResolvedValue({});
    // Escrow off by default — the credit path checks the merchant's opt-in.
    escrowService.autoRelease.mockResolvedValue(undefined);
    prisma.payment.updateMany.mockResolvedValue({ count: 1 });
    prisma.payment.findMany.mockResolvedValue([]);
    prisma.merchantBalance.update.mockResolvedValue({});
    prisma.merchant.findUnique.mockResolvedValue({
      settlementHoldEnabled: false,
    });
    prisma.merchantBalance.upsert.mockResolvedValue({});
    prisma.merchantLedgerEntry.create.mockResolvedValue({});
    prisma.merchantLedgerEntry.findFirst.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(async (arg: unknown) => {
      if (Array.isArray(arg)) return Promise.all(arg);
      if (typeof arg === 'function') {
        const transaction = arg as (client: typeof prisma) => Promise<unknown>;
        return transaction(prisma);
      }
      return arg;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventsService, useValue: eventsService },
        { provide: QuotesService, useValue: quotesService },
        { provide: StellarService, useValue: stellarService },
        { provide: WebhooksService, useValue: webhooksService },
        { provide: LinksService, useValue: linksService },
        { provide: CctpService, useValue: cctpService },
        { provide: BurnFeeService, useValue: burnFeeService },
        // BullMQ uses a stringly-typed token (`getQueueToken(name)`) for
        // queue injection. We replicate it here without pulling the BullMQ
        // helper into the test — keeps the test surface tiny.
        { provide: `BullQueue_cctp.observe`, useValue: cctpQueue },
        { provide: `BullQueue_settlement.hold`, useValue: holdQueue },
        { provide: EscrowService, useValue: escrowService },
        { provide: ConfigService, useValue: configService },
        {
          provide: NotificationsService,
          useValue: {
            notifyPaymentCompleted: jest.fn(),
            notifyPaymentReceived: jest.fn().mockResolvedValue(undefined),
            sendPaymentReceipt: jest.fn(),
            sendPaymentNotification: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);

    stripeMock = {
      paymentIntents: {
        create: jest.fn().mockResolvedValue({
          id: 'pi_123',
          client_secret: 'pi_123_secret_456',
        }),
      },
      webhooks: {
        constructEvent: jest.fn(),
      },
    };
    Object.defineProperty(service, 'stripe', {
      value: stripeMock,
      writable: true,
    });
  });

  it('creates a Stripe card session and stores intent metadata', async () => {
    const result = await service.createCardSession('pay_123');

    expect(result).toEqual({ clientSecret: 'pi_123_secret_456' });
    expect(stripeMock.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 5000,
        currency: 'usd',
        metadata: {
          paymentId: 'pay_123',
          merchantId: 'merchant_123',
        },
      }),
    );
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pay_123' },
      }),
    );
  });

  it('marks payments completed when Stripe success webhooks arrive', async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue({
      id: 'evt_success',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_123',
          status: 'succeeded',
          metadata: { paymentId: 'pay_123' },
        },
      },
    });

    await service.handleStripeWebhook(
      'stripe-signature',
      Buffer.from('payload'),
    );

    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'COMPLETED' }),
      }),
    );
    expect(prisma.webhookEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: 'payment.completed' }),
      }),
    );
  });

  describe('releasing a settlement hold', () => {
    const heldPayment = {
      ...paymentRecord,
      escrowState: 'HELD',
      escrowId: null,
    };

    it('does nothing for a payment that is not held', async () => {
      prisma.payment.findUnique.mockResolvedValue({
        ...paymentRecord,
        escrowState: null,
      });

      await service.releaseSettlementHold('pay_123');

      expect(prisma.payment.updateMany).not.toHaveBeenCalled();
    });

    it('moves the balance and marks the payment released', async () => {
      prisma.payment.findUnique.mockResolvedValue(heldPayment);
      prisma.payment.updateMany.mockResolvedValue({ count: 1 });

      await service.releaseSettlementHold('pay_123');

      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ escrowState: 'HELD' }),
          data: { escrowState: 'RELEASED' },
        }),
      );
      expect(prisma.merchantBalance.update).toHaveBeenCalled();
    });

    it('credits once when the same job runs twice', async () => {
      // The HELD → RELEASED transition is the guard. A duplicated or retried
      // job must not turn one payment into two credits.
      prisma.payment.findUnique.mockResolvedValue(heldPayment);
      prisma.payment.updateMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 0 });

      await service.releaseSettlementHold('pay_123');
      await service.releaseSettlementHold('pay_123');

      expect(prisma.merchantBalance.update).toHaveBeenCalledTimes(1);
    });

    it('leaves the ledger held when the on-chain release fails', async () => {
      // Crediting spendable balance the contract has not released would be
      // inventing money out of a failed transaction.
      prisma.payment.findUnique.mockResolvedValue({
        ...heldPayment,
        escrowId: 'deadbeef',
      });
      escrowService.autoRelease.mockRejectedValue(new Error('rpc down'));

      await expect(service.releaseSettlementHold('pay_123')).rejects.toThrow(
        'rpc down',
      );

      expect(prisma.payment.updateMany).not.toHaveBeenCalled();
      expect(prisma.merchantBalance.update).not.toHaveBeenCalled();
    });

    it('re-enqueues holds that outlived their job', async () => {
      prisma.payment.findMany.mockResolvedValue([
        { id: 'pay_1', escrowReleaseAt: new Date(Date.now() + 1000) },
        { id: 'pay_2', escrowReleaseAt: new Date(Date.now() - 1000) },
      ]);

      const count = await service.reconcileSettlementHolds();

      expect(count).toBe(2);
      expect(holdQueue.add).toHaveBeenCalledTimes(2);
    });
  });

  describe('selectCrypto — EVM source, Fast Transfer fee', () => {
    const evmPayment = {
      ...paymentRecord,
      destAmount: new Prisma.Decimal('0.01'),
      merchant: {
        id: 'merchant_123',
        settlementAddress:
          'GBBN5WUDNH5P7ZG3CKJIWZ6CXQY2PXL23H2K36QIE53UGAXWZDWJP3D7',
      },
      quote: null,
    };

    beforeEach(() => {
      prisma.payment.findUnique.mockResolvedValue(evmPayment);
      prisma.quote.findUnique.mockResolvedValue({
        id: 'qt_1',
        fromAmount: new Prisma.Decimal('0.01'),
        fromAsset: 'USDC',
        fromChain: 'ethereum',
        toAmount: new Prisma.Decimal('0.01'),
        toAsset: 'USDC',
        toChain: 'stellar',
        rate: new Prisma.Decimal(1),
        feeAmount: new Prisma.Decimal(0),
        feeBps: 50,
        expiresAt: new Date(Date.now() + 600_000),
      });
      quotesService.createQuote.mockResolvedValue({ id: 'qt_1' });
      cctpService.prepareBurn.mockResolvedValue({
        to: '0xTokenMessenger',
        data: '0xdeadbeef',
        value: '0x0',
        description: 'burn',
      });
    });

    // Circle does not reject a Fast Transfer that offers maxFee 0 — it accepts
    // the burn and quietly waits for hard finality, reporting
    // `delayReason: insufficient_fee`. So the burn must carry a real fee, or
    // the checkout's "8–20 seconds" is a lie every single time.
    it('pays the fee Circle asks for rather than offering zero', async () => {
      await service.selectCrypto('pay_123', 'ethereum');

      const [req] = cctpService.prepareBurn.mock.calls.at(-1) as [
        { speed: string; maxFee: bigint },
      ];
      expect(req.speed).toBe('fast');
      // 0.01 USDC = 10_000 subunits; 1 bp of that is exactly 1.
      expect(req.maxFee).toBe(1n);
      expect(req.maxFee).not.toBe(0n);
    });

    // Sending a fast burn we know will be demoted would mean the status page
    // promises seconds and delivers a quarter of an hour. Standard finality is
    // slower but it is the truth.
    it('drops to standard finality when the fee cannot be looked up', async () => {
      burnFeeService.minimumFeeBps.mockResolvedValueOnce(null);

      await service.selectCrypto('pay_123', 'ethereum');

      const [req] = cctpService.prepareBurn.mock.calls.at(-1) as [
        { speed: string; maxFee: bigint },
      ];
      expect(req.speed).toBe('standard');
      expect(req.maxFee).toBe(0n);
    });
  });

  describe('selectCrypto — Stellar-native source', () => {
    const merchantWithWallet = {
      ...paymentRecord,
      destAmount: new Prisma.Decimal(50),
      merchant: {
        id: 'merchant_123',
        settlementAddress:
          'GBBN5WUDNH5P7ZG3CKJIWZ6CXQY2PXL23H2K36QIE53UGAXWZDWJP3D7',
      },
      quote: null,
    };

    beforeEach(() => {
      prisma.payment.findUnique.mockResolvedValue(merchantWithWallet);
      prisma.quote.findUnique.mockResolvedValue({
        id: 'qt_1',
        fromAmount: new Prisma.Decimal(50),
        fromAsset: 'USDC',
        fromChain: 'stellar',
        toAmount: new Prisma.Decimal(50),
        toAsset: 'USDC',
        toChain: 'stellar',
        rate: new Prisma.Decimal(1),
        feeAmount: new Prisma.Decimal(0.25),
        feeBps: 50,
        expiresAt: new Date(Date.now() + 30_000),
      });
      quotesService.createQuote.mockResolvedValue({ id: 'qt_1' });
    });

    it('no longer rejects a Stellar source', async () => {
      // This is the whole point: a payer already holding USDC on Stellar used
      // to be told to go away and bridge.
      await expect(service.selectCrypto('pay_123', 'stellar')).resolves.toEqual(
        expect.objectContaining({ method: 'stellar' }),
      );
    });

    it('returns a payment instruction rather than burn calldata', async () => {
      const res = await service.selectCrypto('pay_123', 'stellar');

      expect(res.wallet).toBeUndefined();
      expect(res.stellar).toEqual(
        expect.objectContaining({
          destination: merchantWithWallet.merchant.settlementAddress,
          amount: '50',
          asset: expect.objectContaining({ code: 'USDC' }),
        }),
      );
    });

    it('memo fits MEMO_TEXT and ties back to the payment', async () => {
      const res = await service.selectCrypto('pay_123', 'stellar');

      expect(res.stellar?.memo).toBe('pay_123');
      expect(Buffer.byteLength(res.stellar!.memo, 'utf8')).toBeLessThanOrEqual(
        28,
      );
    });

    it('uses the testnet USDC issuer and passphrase off mainnet', async () => {
      const res = await service.selectCrypto('pay_123', 'stellar');

      expect(res.stellar?.asset.issuer).toBe(
        'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      );
      expect(res.stellar?.networkPassphrase).toContain('Test SDF Network');
    });

    it('still refuses a merchant with no settlement address', async () => {
      prisma.payment.findUnique.mockResolvedValue({
        ...merchantWithWallet,
        merchant: { id: 'merchant_123', settlementAddress: null },
      });

      await expect(service.selectCrypto('pay_123', 'stellar')).rejects.toThrow(
        /settlement address/i,
      );
    });
  });

  describe('selectCrypto — self-custodied merchant wallet', () => {
    it('names the supported flow instead of failing generically', async () => {
      // A smart wallet is a contract address. A classic payment operation
      // cannot target one, and Circle's mint path is unverified for it — so
      // the error has to say which flow does work rather than look like
      // misconfiguration.
      prisma.payment.findUnique.mockResolvedValue({
        ...paymentRecord,
        destAmount: new Prisma.Decimal(50),
        merchant: {
          id: 'merchant_123',
          settlementAddress:
            'CDKAIND4CJUC4SNVLSXS5CH5GOMNQPBU4F6I2DY4ZFNO7LKP4HM3YAIK',
        },
        quote: null,
      });

      await expect(service.selectCrypto('pay_123', 'stellar')).rejects.toThrow(
        /self-custodied smart wallet/i,
      );
    });

    it('still accepts a classic settlement address', async () => {
      prisma.payment.findUnique.mockResolvedValue({
        ...paymentRecord,
        destAmount: new Prisma.Decimal(50),
        merchant: {
          id: 'merchant_123',
          settlementAddress:
            'GBBN5WUDNH5P7ZG3CKJIWZ6CXQY2PXL23H2K36QIE53UGAXWZDWJP3D7',
        },
        quote: null,
      });
      prisma.quote.findUnique.mockResolvedValue({
        id: 'qt_1',
        fromAmount: new Prisma.Decimal(50),
        fromAsset: 'USDC',
        fromChain: 'stellar',
        toAmount: new Prisma.Decimal(50),
        toAsset: 'USDC',
        toChain: 'stellar',
        rate: new Prisma.Decimal(1),
        feeAmount: new Prisma.Decimal(0.25),
        feeBps: 50,
        expiresAt: new Date(Date.now() + 30_000),
      });
      quotesService.createQuote.mockResolvedValue({ id: 'qt_1' });

      await expect(service.selectCrypto('pay_123', 'stellar')).resolves.toEqual(
        expect.objectContaining({ method: 'stellar' }),
      );
    });
  });

  describe('buildStellarEscrowTx', () => {
    // Restored after this block so later describes see the original stub.
    afterAll(() => {
      configService.get.mockImplementation((key: string) =>
        key === 'STRIPE_WEBHOOK_SECRET' ? 'whsec_test' : undefined,
      );
    });

    const PAYER = 'GBBN5WUDNH5P7ZG3CKJIWZ6CXQY2PXL23H2K36QIE53UGAXWZDWJP3D7';
    const base = {
      ...paymentRecord,
      status: 'QUOTE_LOCKED',
      sourceChain: 'stellar',
      destAmount: new Prisma.Decimal(50),
      merchant: {
        id: 'merchant_123',
        settlementAddress:
          'GDRVV7TZDPEQ2BFZOZDS2B572IWPPOZRR4IJUXJGNUCYOY523RZ76IDV',
        settlementHoldEnabled: true,
        settlementHoldSeconds: 604800,
      },
    };

    beforeEach(() => {
      prisma.payment.findUnique.mockResolvedValue(base);
      // Keep the outer mock's other keys: jest.clearAllMocks() clears calls
      // but not implementations, so an override here would leak into every
      // describe that runs after this one.
      configService.get.mockImplementation((k: string) => {
        if (k === 'STELLAR_USDC_SAC_TESTNET') return 'CUSDCSAC';
        if (k === 'STRIPE_WEBHOOK_SECRET') return 'whsec_test';
        return undefined;
      });
      escrowService.buildLockTransaction.mockResolvedValue({
        xdr: 'AAAA...',
        networkPassphrase: 'Test SDF Network ; September 2015',
      });
    });

    it('records the payer as the escrow payer, not us', async () => {
      // The whole reason this flow exists: a dispute must be able to refund
      // the person who actually paid.
      await service.buildStellarEscrowTx('pay_123', PAYER);

      expect(escrowService.buildLockTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          payerAddress: PAYER,
          merchantAddress: base.merchant.settlementAddress,
        }),
      );
    });

    it('sets release_at from the merchant hold window', async () => {
      const before = Date.now();
      const res = await service.buildStellarEscrowTx('pay_123', PAYER);

      const releaseAt = new Date(res.releaseAt).getTime();
      expect(releaseAt).toBeGreaterThanOrEqual(before + 604800 * 1000 - 5000);
    });

    it('refuses a CCTP payer, who cannot be refunded by the contract', async () => {
      prisma.payment.findUnique.mockResolvedValue({
        ...base,
        sourceChain: 'base',
      });

      await expect(
        service.buildStellarEscrowTx('pay_123', PAYER),
      ).rejects.toThrow(/only available for Stellar-native/i);
      expect(escrowService.buildLockTransaction).not.toHaveBeenCalled();
    });

    it('refuses when the merchant has not opted in', async () => {
      prisma.payment.findUnique.mockResolvedValue({
        ...base,
        merchant: { ...base.merchant, settlementHoldEnabled: false },
      });

      await expect(
        service.buildStellarEscrowTx('pay_123', PAYER),
      ).rejects.toThrow(/has not enabled a settlement hold/i);
    });

    it('refuses a payment that is not awaiting funds', async () => {
      prisma.payment.findUnique.mockResolvedValue({
        ...base,
        status: 'COMPLETED',
      });

      await expect(
        service.buildStellarEscrowTx('pay_123', PAYER),
      ).rejects.toThrow(/cannot start an escrow/i);
    });

    it('says which variable is missing when the USDC contract id is unset', async () => {
      configService.get.mockImplementation((k: string) =>
        k === 'STRIPE_WEBHOOK_SECRET' ? 'whsec_test' : undefined,
      );

      await expect(
        service.buildStellarEscrowTx('pay_123', PAYER),
      ).rejects.toThrow(/STELLAR_USDC_SAC_TESTNET/);
    });
  });

  describe('submitStellarPayment', () => {
    const HASH = 'a'.repeat(64);
    const settled = {
      ...paymentRecord,
      status: 'QUOTE_LOCKED',
      destAmount: new Prisma.Decimal(50),
      stellarTxHash: null,
      merchant: {
        id: 'merchant_123',
        settlementAddress:
          'GBBN5WUDNH5P7ZG3CKJIWZ6CXQY2PXL23H2K36QIE53UGAXWZDWJP3D7',
      },
    };

    beforeEach(() => {
      prisma.payment.findUnique.mockResolvedValue(settled);
      prisma.payment.findFirst.mockResolvedValue(null);
      stellarService.verifyIncomingPayment.mockResolvedValue({ ok: true });
    });

    it('completes the payment when the ledger confirms it', async () => {
      const res = await service.submitStellarPayment('pay_123', HASH);

      expect(res.status).toBe('COMPLETED');
      expect(stellarService.verifyIncomingPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          txHash: HASH,
          destination: settled.merchant.settlementAddress,
          minAmount: '50',
          assetCode: 'USDC',
        }),
      );
    });

    it('refuses a transaction the ledger does not back', async () => {
      // The client says where to look; it does not get to say what happened.
      stellarService.verifyIncomingPayment.mockResolvedValue({
        ok: false,
        reason: 'transaction not found on the ledger',
      });

      await expect(
        service.submitStellarPayment('pay_123', HASH),
      ).rejects.toThrow(/could not be verified/);
      expect(prisma.payment.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'COMPLETED' }),
        }),
      );
    });

    it('refuses a transaction already applied to another payment', async () => {
      // Without this, one transfer could be presented against every open
      // payment a merchant has and settle all of them.
      prisma.payment.findFirst.mockResolvedValue({ id: 'pay_other' });

      await expect(
        service.submitStellarPayment('pay_123', HASH),
      ).rejects.toThrow(/already been applied/);
      expect(stellarService.verifyIncomingPayment).not.toHaveBeenCalled();
    });

    it('is idempotent for a retry of the same hash', async () => {
      prisma.payment.findUnique.mockResolvedValue({
        ...settled,
        status: 'COMPLETED',
        stellarTxHash: HASH,
      });

      const res = await service.submitStellarPayment('pay_123', HASH);

      expect(res.status).toBe('COMPLETED');
      expect(stellarService.verifyIncomingPayment).not.toHaveBeenCalled();
    });

    it('refuses a payment that is not awaiting funds', async () => {
      prisma.payment.findUnique.mockResolvedValue({
        ...settled,
        status: 'REFUNDED',
      });

      await expect(
        service.submitStellarPayment('pay_123', HASH),
      ).rejects.toThrow(/cannot accept a Stellar payment/);
    });
  });

  describe('submitStellarPayment — escrow-backed', () => {
    const HASH = 'b'.repeat(64);
    const MERCHANT = 'GDRVV7TZDPEQ2BFZOZDS2B572IWPPOZRR4IJUXJGNUCYOY523RZ76IDV';
    const escrowed = {
      ...paymentRecord,
      status: 'QUOTE_LOCKED',
      destAmount: new Prisma.Decimal(50),
      stellarTxHash: null,
      escrowId: 'a1b2c3',
      merchant: { id: 'merchant_123', settlementAddress: MERCHANT },
    };

    beforeEach(() => {
      prisma.payment.findUnique.mockResolvedValue(escrowed);
      prisma.payment.findFirst.mockResolvedValue(null);
      escrowService.getEscrow.mockResolvedValue({
        state: 'Locked',
        amount: 50_000_000n,
        releaseAt: 0n,
        disputedAt: 0n,
        payer: 'GBBN5WUDNH5P7ZG3CKJIWZ6CXQY2PXL23H2K36QIE53UGAXWZDWJP3D7',
        merchant: MERCHANT,
      });
    });

    it('verifies against the contract, not a payment to the merchant', async () => {
      // An escrowed payment pays the contract, so a destination check would
      // never match — the contract's own entry is the authority.
      const res = await service.submitStellarPayment('pay_123', HASH);

      expect(res.status).toBe('COMPLETED');
      expect(escrowService.getEscrow).toHaveBeenCalledWith('a1b2c3');
      expect(stellarService.verifyIncomingPayment).not.toHaveBeenCalled();
    });

    it('refuses an escrow that is not actually Locked', async () => {
      escrowService.getEscrow.mockResolvedValue({
        state: 'Released',
        amount: 50_000_000n,
        releaseAt: 0n,
        disputedAt: 0n,
        payer: 'G...',
        merchant: MERCHANT,
      });

      await expect(
        service.submitStellarPayment('pay_123', HASH),
      ).rejects.toThrow(/expected Locked/);
    });

    it('refuses an escrow naming a different merchant', async () => {
      // Would mean the recorded id belongs to somebody else's escrow.
      escrowService.getEscrow.mockResolvedValue({
        state: 'Locked',
        amount: 50_000_000n,
        releaseAt: 0n,
        disputedAt: 0n,
        payer: 'G...',
        merchant: 'GOTHERMERCHANTADDRESS',
      });

      await expect(
        service.submitStellarPayment('pay_123', HASH),
      ).rejects.toThrow(/does not name this merchant/);
    });

    it('refuses an escrow holding less than the payment', async () => {
      escrowService.getEscrow.mockResolvedValue({
        state: 'Locked',
        amount: 1n,
        releaseAt: 0n,
        disputedAt: 0n,
        payer: 'G...',
        merchant: MERCHANT,
      });

      await expect(
        service.submitStellarPayment('pay_123', HASH),
      ).rejects.toThrow(/expected at least/);
    });
  });

  describe('settlement hold on completion', () => {
    const completeAPayment = async () => {
      stripeMock.webhooks.constructEvent.mockReturnValue({
        id: 'evt_success',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_123',
            status: 'succeeded',
            metadata: { paymentId: 'pay_123' },
          },
        },
      });
      await service.handleStripeWebhook(
        'stripe-signature',
        Buffer.from('payload'),
      );
    };

    it('credits spendable balance when the merchant has not opted in', async () => {
      prisma.merchant.findUnique.mockResolvedValue({
        settlementHoldEnabled: false,
      });

      await completeAPayment();

      expect(prisma.merchantBalance.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            availableAmount: expect.anything(),
          }),
        }),
      );
      const call = prisma.merchantBalance.upsert.mock.calls[0][0];
      expect(call.update.reservedAmount).toBeUndefined();
    });

    it('holds the credit as reserved when the merchant has opted in', async () => {
      // The point of the whole feature: a held payment must not become
      // spendable at completion, or the window protects nothing.
      prisma.merchant.findUnique.mockResolvedValue({
        settlementHoldEnabled: true,
      });

      await completeAPayment();

      const call = prisma.merchantBalance.upsert.mock.calls[0][0];
      expect(call.update.reservedAmount).toBeDefined();
      expect(call.update.availableAmount).toBeUndefined();
      expect(call.create.availableAmount).toBe(0);
    });

    it('does not claim escrow for a payer who cannot use it', async () => {
      // A CCTP payer has no Stellar account to authorize a lock and no address
      // the contract could refund to. Labelling their hold "escrow" would
      // promise a guarantee the chain is not making.
      prisma.merchant.findUnique.mockResolvedValue({
        settlementHoldEnabled: true,
      });
      // The Stripe path credits the row it looked up, not the updated one.
      prisma.payment.findUnique.mockResolvedValue({
        ...paymentRecord,
        sourceChain: 'base',
      });

      await completeAPayment();

      expect(prisma.merchantLedgerEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            description:
              'Payment completion credit (held for settlement window)',
          }),
        }),
      );
    });

    it('calls it escrow only when the payer is Stellar-native', async () => {
      prisma.merchant.findUnique.mockResolvedValue({
        settlementHoldEnabled: true,
      });
      prisma.payment.findUnique.mockResolvedValue({
        ...paymentRecord,
        sourceChain: 'stellar',
      });

      await completeAPayment();

      expect(prisma.merchantLedgerEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            description: 'Payment completion credit (held on-chain in escrow)',
          }),
        }),
      );
    });
  });

  describe('createFromLink', () => {
    const fixedLinkResolve = {
      id: 'lnk_abc',
      amount: 25,
      currency: 'USD',
      description: null,
      singleUse: false,
      expiresAt: null,
      merchantName: 'Acme',
      merchantCompanyName: null,
      merchantLogo: null,
      merchantBrandColor: null,
    };

    const openLinkResolve = { ...fixedLinkResolve, amount: null };

    const internalLink = {
      id: 'cuid_internal_abc',
      merchant: {
        id: 'merchant_123',
        settlementAsset: 'USDC',
        settlementChain: 'stellar',
        settlementAddress: 'GBRR...',
      },
    };

    beforeEach(() => {
      prisma.paymentLink.findUnique.mockResolvedValue(internalLink);
      prisma.payment.create.mockResolvedValue({
        id: 'pay_new',
        merchantId: 'merchant_123',
      });
      prisma.payment.delete.mockResolvedValue(undefined);
      linksService.resolve.mockResolvedValue(fixedLinkResolve);
      linksService.markUsed.mockResolvedValue(1);
    });

    it('creates a pre-quote payment for a fixed-amount link', async () => {
      const result = await service.createFromLink('aBcDeFgH', {});

      expect(result).toEqual({ id: 'pay_new' });
      expect(linksService.resolve).toHaveBeenCalledWith('aBcDeFgH');
      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            merchantId: 'merchant_123',
            status: 'PENDING',
            destChain: 'stellar',
            destAsset: 'USDC',
            destAddress: 'GBRR...',
            linkId: 'cuid_internal_abc',
            // Source fields are explicitly absent on link-initiated payments
            // — they get filled in when the customer picks a method.
          }),
        }),
      );
      const createCall = prisma.payment.create.mock.calls[0] as [
        { data: Record<string, unknown> },
      ];
      const data = createCall[0].data;
      // Source fields (and the quote) stay null until the customer picks a
      // payment method — link-initiated payments are created pre-quote.
      expect(data.sourceChain).toBeNull();
      expect(data.sourceAsset).toBeNull();
      expect(data.sourceAmount).toBeNull();
      expect(data.quoteId).toBeNull();
      // Fixed-amount link → destAmount comes from link.amount, not body.
      expect(String((data as { destAmount: unknown }).destAmount)).toBe('25');
      expect(linksService.markUsed).toHaveBeenCalledWith(
        'cuid_internal_abc',
        'pay_new',
      );
    });

    it('uses caller-supplied amount for open-amount links', async () => {
      linksService.resolve.mockResolvedValue(openLinkResolve);

      await service.createFromLink('OpEnLiNk', { amount: 42 });

      const createCall = prisma.payment.create.mock.calls[0] as [
        { data: { destAmount: unknown } },
      ];
      expect(String(createCall[0].data.destAmount)).toBe('42');
    });

    it('rejects open-amount link without a supplied amount', async () => {
      linksService.resolve.mockResolvedValue(openLinkResolve);

      await expect(service.createFromLink('OpEnLiNk', {})).rejects.toThrow(
        /requires an amount/i,
      );
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });

    it('ignores caller-supplied amount on a fixed-amount link', async () => {
      // Customer can't override the merchant's price by passing { amount }
      await service.createFromLink('aBcDeFgH', { amount: 999 });

      const createCall = prisma.payment.create.mock.calls[0] as [
        { data: { destAmount: unknown } },
      ];
      expect(String(createCall[0].data.destAmount)).toBe('25');
    });

    it('rolls back the payment if markUsed loses the single-use race', async () => {
      linksService.markUsed.mockRejectedValue(
        new Error('single-use link already consumed'),
      );

      await expect(service.createFromLink('aBcDeFgH', {})).rejects.toThrow(
        /single-use/i,
      );

      // Payment row was created, then deleted as cleanup.
      expect(prisma.payment.create).toHaveBeenCalledTimes(1);
      expect(prisma.payment.delete).toHaveBeenCalledWith({
        where: { id: 'pay_new' },
      });
    });

    it('surfaces resolve errors (404/410) untouched', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      linksService.resolve.mockRejectedValue(
        new NotFoundException('Payment link not found'),
      );

      await expect(service.createFromLink('NoPe', {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });
  });
});
