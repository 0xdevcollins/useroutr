import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MerchantService } from './merchant.service';

/**
 * The settlement-hold toggle.
 *
 * The hold and the escrow path behind it were built before anything could
 * turn them on — `settlementHoldEnabled` was read in the payment path but
 * writable nowhere, so it was permanently false in production. These tests
 * exist to keep it reachable.
 */
describe('MerchantService — settlement hold', () => {
  let service: MerchantService;

  const prisma = {
    merchant: { findUnique: jest.fn(), update: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.merchant.findUnique.mockResolvedValue({ id: 'm1' });
    prisma.merchant.update.mockImplementation((args: { data: unknown }) => ({
      id: 'm1',
      passwordHash: 'secret',
      apiKeyHash: 'secret',
      ...(args.data as Record<string, unknown>),
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MerchantService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: {} },
      ],
    }).compile();
    service = module.get(MerchantService);
  });

  it('turns the hold on', async () => {
    const res = await service.updateSettlement('m1', {
      settlementHoldEnabled: true,
    });

    expect(prisma.merchant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ settlementHoldEnabled: true }),
      }),
    );
    expect(res).toEqual(
      expect.objectContaining({ settlementHoldEnabled: true }),
    );
  });

  it('turns the hold off again', async () => {
    // `false` is falsy, so a naive `dto.x && {...}` spread would silently drop
    // it and leave a merchant unable to opt back out.
    await service.updateSettlement('m1', { settlementHoldEnabled: false });

    expect(prisma.merchant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ settlementHoldEnabled: false }),
      }),
    );
  });

  it('sets the window alongside the flag', async () => {
    await service.updateSettlement('m1', {
      settlementHoldEnabled: true,
      settlementHoldSeconds: 172_800,
    });

    expect(prisma.merchant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ settlementHoldSeconds: 172_800 }),
      }),
    );
  });

  it('leaves the hold untouched when the field is absent', async () => {
    // Settlement settings are patched from several places; an unrelated update
    // must not silently disable a merchant's hold.
    await service.updateSettlement('m1', { settlementAsset: 'USDC' });

    const data = prisma.merchant.update.mock.calls[0][0].data as Record<
      string,
      unknown
    >;
    expect(data.settlementHoldEnabled).toBeUndefined();
    expect(data.settlementHoldSeconds).toBeUndefined();
  });

  it('does not leak credentials in the response', async () => {
    const res = (await service.updateSettlement('m1', {
      settlementHoldEnabled: true,
    })) as Record<string, unknown>;

    expect(res.passwordHash).toBeUndefined();
    expect(res.apiKeyHash).toBeUndefined();
  });
});
