import { PaymentsService } from './payments.service.js';

describe('PaymentsService', () => {
  const paymentRecord = {
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
    },
    webhookEvent: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'STRIPE_WEBHOOK_SECRET') {
        return 'whsec_test';
      }

      return undefined;
    }),
  };

  let service: PaymentsService;
  let stripeMock: {
    paymentIntents: { create: jest.Mock };
    webhooks: { constructEvent: jest.Mock };
  };

  beforeEach(() => {
    jest.clearAllMocks();

    prisma.payment.findUnique.mockResolvedValue(paymentRecord);
    prisma.payment.update.mockResolvedValue(paymentRecord);
    prisma.webhookEvent.create.mockResolvedValue({});
    prisma.$transaction.mockResolvedValue(undefined);

    service = new PaymentsService(prisma as never, configService as never);
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
        data: expect.objectContaining({
          status: 'COMPLETED',
        }),
      }),
    );
    expect(prisma.webhookEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'payment.completed',
        }),
      }),
    );
  });
});
