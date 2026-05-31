import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events/events.service';
import { QuotesService } from '../quotes/quotes.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { LinksService } from '../links/links.service';
import { CctpService } from '../cctp/cctp.service';

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
      findUnique: jest.fn(),
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
    $transaction: jest.fn(),
  };

  const eventsService = {
    emitPaymentStatus: jest.fn(),
  };

  const quotesService = {
    validateAndConsume: jest.fn(),
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

  // BullMQ queue double — submitBurn enqueues a cctp.observe job after
  // recording the source tx hash. Tests assert the call was made; the
  // worker itself is exercised by its own spec.
  const cctpQueue = {
    add: jest.fn(),
  };

  const configService = {
    get: jest.fn((key: string) => {
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
    prisma.$transaction.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventsService, useValue: eventsService },
        { provide: QuotesService, useValue: quotesService },
        { provide: WebhooksService, useValue: webhooksService },
        { provide: LinksService, useValue: linksService },
        { provide: CctpService, useValue: cctpService },
        // BullMQ uses a stringly-typed token (`getQueueToken(name)`) for
        // queue injection. We replicate it here without pulling the BullMQ
        // helper into the test — keeps the test surface tiny.
        { provide: `BullQueue_cctp.observe`, useValue: cctpQueue },
        { provide: ConfigService, useValue: configService },
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({ status: 'COMPLETED' }),
      }),
    );
    expect(prisma.webhookEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({ eventType: 'payment.completed' }),
      }),
    );
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
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
      expect(data).not.toHaveProperty('sourceChain');
      expect(data).not.toHaveProperty('sourceAsset');
      expect(data).not.toHaveProperty('sourceAmount');
      expect(data).not.toHaveProperty('quoteId');
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
