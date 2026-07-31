import { Prisma, PayoutStatus, DestType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PayoutsService } from './payouts.service';
import {
  EXECUTE_PAYOUT_BATCH_JOB,
  EXECUTE_PAYOUT_JOB,
  GENERATE_RECURRING_PAYOUT_JOB,
  RUN_RECURRING_PAYOUTS_JOB,
} from './payouts.constants';

interface MockPayout {
  id: string;
  merchantId: string;
  recipientId: string | null;
  recipientName: string;
  destinationType: DestType;
  destination: Record<string, unknown>;
  amount: Prisma.Decimal;
  currency: string;
  status: PayoutStatus;
  stellarTxHash: string | null;
  scheduledAt: Date | null;
  confirmedAt: Date | null;
  confirmationCodeHash: string | null;
  confirmationCodeExpiresAt: Date | null;
  confirmationAttempts: number;
  completedAt: Date | null;
  failureReason: string | null;
  batchId: string | null;
  idempotencyKey: string | null;
  recurringPayoutId: string | null;
  createdAt: Date;
}

interface MockRecurringPayout {
  id: string;
  merchantId: string;
  recipientId: string | null;
  recipientName: string;
  destinationType: DestType;
  destination: Record<string, unknown>;
  amount: Prisma.Decimal;
  currency: string;
  frequency: 'DAILY' | 'WEEKLY' | 'BI_WEEKLY' | 'MONTHLY';
  nextRunAt: Date;
  lastRunAt: Date | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

describe('PayoutsService', () => {
  const now = new Date('2026-07-28T12:00:00.000Z');
  const merchantId = 'merchant_123';

  const queue = {
    add: jest.fn(),
    remove: jest.fn(),
    removeRepeatableByKey: jest.fn(),
  };
  const prisma = {
    payout: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    recurringPayout: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    recipient: {
      findFirst: jest.fn(),
    },
    merchant: {
      findUnique: jest.fn(),
    },
    merchantSettlementKey: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const webhooks = {
    dispatch: jest.fn(),
  };
  const stellar = {
    sendPayment: jest.fn(),
    findStrictSendPaths: jest.fn(),
    executePathPayment: jest.fn(),
  };
  const settlement = {
    decryptSeed: jest.fn(),
  };
  const eventsService = {
    emitPayoutStatus: jest.fn(),
  };
  const notifications = {
    notifyPayoutCompleted: jest.fn(),
    notifyPayoutFailed: jest.fn(),
    sendPayoutApprovalCode: jest.fn(),
  };
  const config = {
    get: jest.fn(),
  };

  let service: PayoutsService;
  let payoutCounter = 0;

  function makePayout(overrides: Partial<MockPayout> = {}): MockPayout {
    payoutCounter += 1;
    return {
      id: overrides.id ?? `payout_${payoutCounter}`,
      merchantId: overrides.merchantId ?? merchantId,
      recipientId: overrides.recipientId ?? null,
      recipientName: overrides.recipientName ?? 'Recipient',
      destinationType: overrides.destinationType ?? DestType.BANK_ACCOUNT,
      destination: overrides.destination ?? {
        type: 'BANK_ACCOUNT',
        accountNumber: '1234567890',
        country: 'US',
      },
      amount: overrides.amount ?? new Prisma.Decimal('10'),
      currency: overrides.currency ?? 'USDC',
      status: overrides.status ?? PayoutStatus.PENDING,
      stellarTxHash: overrides.stellarTxHash ?? null,
      scheduledAt: overrides.scheduledAt ?? null,
      confirmedAt: overrides.confirmedAt ?? null,
      confirmationCodeHash: overrides.confirmationCodeHash ?? null,
      confirmationCodeExpiresAt: overrides.confirmationCodeExpiresAt ?? null,
      confirmationAttempts: overrides.confirmationAttempts ?? 0,
      completedAt: overrides.completedAt ?? null,
      failureReason: overrides.failureReason ?? null,
      batchId: overrides.batchId ?? null,
      idempotencyKey: overrides.idempotencyKey ?? null,
      recurringPayoutId: overrides.recurringPayoutId ?? null,
      createdAt: overrides.createdAt ?? now,
    };
  }

  function makeRecurring(
    overrides: Partial<MockRecurringPayout> = {},
  ): MockRecurringPayout {
    return {
      id: overrides.id ?? 'recurring_123',
      merchantId: overrides.merchantId ?? merchantId,
      recipientId: overrides.recipientId ?? null,
      recipientName: overrides.recipientName ?? 'Recurring Recipient',
      destinationType: overrides.destinationType ?? DestType.BANK_ACCOUNT,
      destination: overrides.destination ?? {
        type: 'BANK_ACCOUNT',
        accountNumber: '1234567890',
        country: 'US',
      },
      amount: overrides.amount ?? new Prisma.Decimal('15'),
      currency: overrides.currency ?? 'USDC',
      frequency: overrides.frequency ?? 'DAILY',
      nextRunAt: overrides.nextRunAt ?? now,
      lastRunAt: overrides.lastRunAt ?? null,
      active: overrides.active ?? true,
      createdAt: overrides.createdAt ?? now,
      updatedAt: overrides.updatedAt ?? now,
    };
  }

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
    jest.clearAllMocks();
    payoutCounter = 0;

    queue.add.mockResolvedValue({});
    queue.remove.mockResolvedValue(1);
    queue.removeRepeatableByKey.mockResolvedValue(undefined);
    webhooks.dispatch.mockResolvedValue(undefined);
    stellar.sendPayment.mockResolvedValue('stellar_tx_hash');
    stellar.findStrictSendPaths.mockResolvedValue({
      paths: [{ path: [], destinationAmount: '10' }],
    });
    stellar.executePathPayment.mockResolvedValue('stellar_path_tx_hash');
    settlement.decryptSeed.mockReturnValue(undefined);
    eventsService.emitPayoutStatus.mockReturnValue(undefined);
    notifications.notifyPayoutCompleted.mockResolvedValue(undefined);
    notifications.notifyPayoutFailed.mockResolvedValue(undefined);
    notifications.sendPayoutApprovalCode.mockResolvedValue(undefined);
    config.get.mockReturnValue(undefined);
    prisma.payout.findUnique.mockResolvedValue(null);
    prisma.payout.findMany.mockResolvedValue([]);
    prisma.payout.count.mockResolvedValue(0);
    prisma.payout.create.mockImplementation(
      async ({ data }: { data: Partial<MockPayout> }) => makePayout(data),
    );
    prisma.payout.update.mockImplementation(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<MockPayout>;
      }) => makePayout({ id: where.id, ...data }),
    );
    prisma.recurringPayout.findUnique.mockResolvedValue(null);
    prisma.recurringPayout.updateMany.mockResolvedValue({ count: 1 });
    prisma.recurringPayout.findMany.mockResolvedValue([]);
    prisma.recurringPayout.create.mockImplementation(
      async ({ data }: { data: Partial<MockRecurringPayout> }) =>
        makeRecurring(data),
    );
    prisma.recurringPayout.update.mockImplementation(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<MockRecurringPayout>;
      }) => makeRecurring({ id: where.id, ...data }),
    );
    prisma.recipient.findFirst.mockResolvedValue(null);
    prisma.merchant.findUnique.mockResolvedValue({
      email: 'merchant@test.dev',
    });
    prisma.merchantSettlementKey.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(async (callback: unknown) => {
      if (typeof callback !== 'function') return callback;
      const tx = {
        $executeRaw: jest.fn().mockResolvedValue(undefined),
        $queryRaw: jest.fn().mockResolvedValue([
          {
            availableAmount: new Prisma.Decimal('1000'),
            currency: 'USDC',
          },
        ]),
        payout: {
          findUnique: jest.fn().mockResolvedValue(makePayout()),
          update: jest
            .fn()
            .mockImplementation(
              async ({
                where,
                data,
              }: {
                where: { id: string };
                data: Partial<MockPayout>;
              }) => makePayout({ id: where.id, ...data }),
            ),
        },
        merchantBalance: {
          update: jest.fn().mockResolvedValue({}),
        },
        merchantLedgerEntry: {
          create: jest.fn().mockResolvedValue({}),
        },
      };
      const transaction = callback as (client: typeof tx) => Promise<unknown>;
      return transaction(tx);
    });

    service = new PayoutsService(
      prisma as never,
      webhooks as never,
      stellar as never,
      settlement as never,
      eventsService as never,
      notifications as never,
      config as never,
      queue as never,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('queues scheduled payouts as delayed BullMQ jobs', async () => {
    const scheduledAt = new Date(now.getTime() + 60_000);
    const payout = makePayout({ id: 'scheduled_1', scheduledAt });
    prisma.payout.create.mockResolvedValueOnce(payout);

    await service.create(merchantId, {
      recipientName: 'Scheduled Recipient',
      destinationType: 'BANK_ACCOUNT',
      destination: {
        type: 'BANK_ACCOUNT',
        accountNumber: '1234567890',
        country: 'US',
      },
      amount: '10',
      currency: 'USDC',
      scheduledAt,
    });

    expect(queue.add).toHaveBeenCalledWith(
      EXECUTE_PAYOUT_JOB,
      { payoutId: 'scheduled_1' },
      expect.objectContaining({
        jobId: 'payout-scheduled_1',
        delay: 60_000,
        attempts: 1,
      }),
    );
  });

  it('groups due bulk payouts into a single batch job', async () => {
    prisma.payout.create
      .mockResolvedValueOnce(makePayout({ id: 'bulk_1' }))
      .mockResolvedValueOnce(makePayout({ id: 'bulk_2' }));

    const result = await service.createBulk(merchantId, {
      payouts: [
        {
          recipientName: 'Bulk One',
          destinationType: 'BANK_ACCOUNT',
          destination: {
            type: 'BANK_ACCOUNT',
            accountNumber: '1234567890',
            country: 'US',
          },
          amount: '10',
          currency: 'USDC',
        },
        {
          recipientName: 'Bulk Two',
          destinationType: 'BANK_ACCOUNT',
          destination: {
            type: 'BANK_ACCOUNT',
            accountNumber: '9876543210',
            country: 'US',
          },
          amount: '20',
          currency: 'USDC',
        },
      ],
    });

    expect(result.accepted).toBe(2);
    expect(queue.add).toHaveBeenCalledTimes(1);
    expect(queue.add).toHaveBeenCalledWith(
      EXECUTE_PAYOUT_BATCH_JOB,
      { batchId: result.batchId },
      expect.objectContaining({
        jobId: `payout-batch-${result.batchId}`,
        attempts: 1,
      }),
    );
  });

  it('requires confirmation for payouts above the configured threshold', async () => {
    config.get.mockImplementation((key: string) =>
      key === 'PAYOUT_2FA_THRESHOLD' ? '100' : undefined,
    );
    const highValuePayout = makePayout({
      id: 'approval_1',
      amount: new Prisma.Decimal('500'),
      status: PayoutStatus.REQUIRES_CONFIRMATION,
      confirmationCodeHash: 'hashed-code',
      confirmationCodeExpiresAt: new Date(now.getTime() + 600_000),
    });
    prisma.payout.create.mockResolvedValueOnce(highValuePayout);

    const payout = await service.create(merchantId, {
      recipientName: 'High Value Recipient',
      destinationType: 'BANK_ACCOUNT',
      destination: {
        type: 'BANK_ACCOUNT',
        accountNumber: '1234567890',
        country: 'US',
      },
      amount: '500',
      currency: 'USDC',
    });

    expect(payout.status).toBe(PayoutStatus.REQUIRES_CONFIRMATION);
    expect(queue.add).not.toHaveBeenCalled();
    expect(notifications.sendPayoutApprovalCode).toHaveBeenCalledWith(
      'merchant@test.dev',
      expect.objectContaining({
        payoutId: 'approval_1',
        amount: '500',
        currency: 'USDC',
      }),
    );
  });

  it('fails insufficient-balance payouts without debiting funds', async () => {
    const pending = makePayout({
      id: 'poor_1',
      amount: new Prisma.Decimal('50'),
    });
    const txBalanceUpdate = jest.fn();
    const txLedgerCreate = jest.fn();
    prisma.payout.findUnique.mockResolvedValueOnce(pending);
    prisma.$transaction.mockImplementationOnce(async (callback: unknown) => {
      const tx = {
        $executeRaw: jest.fn().mockResolvedValue(undefined),
        $queryRaw: jest.fn().mockResolvedValue([
          {
            availableAmount: new Prisma.Decimal('10'),
            currency: 'USDC',
          },
        ]),
        payout: {
          findUnique: jest.fn().mockResolvedValue(pending),
          update: jest.fn(),
        },
        merchantBalance: {
          update: txBalanceUpdate,
        },
        merchantLedgerEntry: {
          create: txLedgerCreate,
        },
      };
      const transaction = callback as (client: typeof tx) => Promise<unknown>;
      return transaction(tx);
    });

    await service.processQueuedPayout('poor_1');

    expect(txBalanceUpdate).not.toHaveBeenCalled();
    expect(txLedgerCreate).not.toHaveBeenCalled();
    expect(prisma.payout.update).toHaveBeenCalledWith({
      where: { id: 'poor_1' },
      data: {
        status: PayoutStatus.FAILED,
        failureReason: 'Insufficient balance for USDC',
      },
    });
  });

  it('generates a payout from due recurring configuration and schedules the next run', async () => {
    const recurring = makeRecurring({
      id: 'recurring_1',
      frequency: 'DAILY',
      nextRunAt: now,
    });
    const generated = makePayout({
      id: 'generated_1',
      recurringPayoutId: 'recurring_1',
      scheduledAt: now,
    });
    prisma.recurringPayout.findUnique.mockResolvedValueOnce(recurring);
    prisma.payout.create.mockResolvedValueOnce(generated);

    await service.processRecurringPayout('recurring_1');

    expect(prisma.payout.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        merchantId,
        recurringPayoutId: 'recurring_1',
        status: PayoutStatus.PENDING,
        scheduledAt: now,
      }),
    });
    expect(prisma.recurringPayout.updateMany).toHaveBeenCalledWith({
      where: { id: 'recurring_1', active: true, nextRunAt: now },
      data: {
        lastRunAt: now,
        nextRunAt: new Date('2026-07-29T12:00:00.000Z'),
      },
    });
    expect(queue.add).toHaveBeenCalledWith(
      EXECUTE_PAYOUT_JOB,
      { payoutId: 'generated_1' },
      expect.objectContaining({ jobId: 'payout-generated_1' }),
    );
  });

  it('does not generate a payout when the recurring run is not yet due', async () => {
    const recurring = makeRecurring({
      id: 'recurring_future',
      nextRunAt: new Date(now.getTime() + 60_000),
    });
    prisma.recurringPayout.findUnique.mockResolvedValueOnce(recurring);

    await service.processRecurringPayout('recurring_future');

    expect(prisma.recurringPayout.updateMany).not.toHaveBeenCalled();
    expect(prisma.payout.create).not.toHaveBeenCalled();
  });

  it('does not generate a payout when another worker already claimed the run', async () => {
    const recurring = makeRecurring({ id: 'recurring_raced', nextRunAt: now });
    prisma.recurringPayout.findUnique.mockResolvedValueOnce(recurring);
    prisma.recurringPayout.updateMany.mockResolvedValueOnce({ count: 0 });

    await service.processRecurringPayout('recurring_raced');

    expect(prisma.payout.create).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('removes any stale job before re-enqueuing a payout so retries execute', async () => {
    const failed = makePayout({ id: 'retry_1', status: PayoutStatus.FAILED });
    prisma.payout.findUnique.mockResolvedValueOnce(failed);
    prisma.payout.update.mockResolvedValueOnce(
      makePayout({ id: 'retry_1', status: PayoutStatus.PENDING }),
    );

    await service.retry('retry_1', merchantId);

    expect(queue.remove).toHaveBeenCalledWith('payout-retry_1');
    expect(queue.add).toHaveBeenCalledWith(
      EXECUTE_PAYOUT_JOB,
      { payoutId: 'retry_1' },
      expect.objectContaining({ jobId: 'payout-retry_1' }),
    );
    const removeOrder = queue.remove.mock.invocationCallOrder[0];
    const addOrder = queue.add.mock.invocationCallOrder[0];
    expect(removeOrder).toBeLessThan(addOrder);
  });

  it('fails the payout after too many invalid confirmation attempts', async () => {
    const pending = makePayout({
      id: 'confirm_1',
      status: PayoutStatus.REQUIRES_CONFIRMATION,
      confirmationCodeHash: bcrypt.hashSync('654321', 4),
      confirmationCodeExpiresAt: new Date(now.getTime() + 600_000),
    });
    prisma.payout.findUnique.mockResolvedValueOnce(pending);
    prisma.payout.update.mockResolvedValueOnce(
      makePayout({
        id: 'confirm_1',
        status: PayoutStatus.REQUIRES_CONFIRMATION,
        confirmationAttempts: 5,
      }),
    );

    await expect(
      service.confirm('confirm_1', merchantId, { code: '000000' }),
    ).rejects.toThrow('Too many invalid confirmation attempts');

    expect(prisma.payout.update).toHaveBeenCalledWith({
      where: { id: 'confirm_1' },
      data: { confirmationAttempts: { increment: 1 } },
    });
    expect(prisma.payout.update).toHaveBeenCalledWith({
      where: { id: 'confirm_1' },
      data: {
        status: PayoutStatus.FAILED,
        failureReason: 'Too many invalid confirmation attempts',
      },
    });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('reconciles persisted scheduled and recurring jobs on bootstrap', async () => {
    prisma.payout.findMany.mockResolvedValueOnce([
      makePayout({ id: 'scheduled_restart', scheduledAt: now }),
    ]);
    prisma.recurringPayout.findMany.mockResolvedValueOnce([
      makeRecurring({ id: 'recurring_restart', nextRunAt: now }),
    ]);

    await service.onApplicationBootstrap();

    expect(queue.add).toHaveBeenCalledWith(
      EXECUTE_PAYOUT_JOB,
      { payoutId: 'scheduled_restart' },
      expect.objectContaining({ jobId: 'payout-scheduled_restart' }),
    );
    expect(queue.add).toHaveBeenCalledWith(
      GENERATE_RECURRING_PAYOUT_JOB,
      { recurringPayoutId: 'recurring_restart' },
      expect.objectContaining({
        jobId: 'recurring-payout-recurring_restart',
        repeat: expect.objectContaining({
          key: 'recurring-payout-recurring_restart',
        }),
      }),
    );
    expect(queue.add).toHaveBeenCalledWith(
      RUN_RECURRING_PAYOUTS_JOB,
      {},
      expect.objectContaining({
        jobId: 'run-recurring-payouts',
        repeat: expect.objectContaining({ every: 30_000 }),
      }),
    );
  });
});
