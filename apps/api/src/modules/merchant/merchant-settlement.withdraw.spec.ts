import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MerchantSettlementService } from './merchant-settlement.service';

/**
 * The withdrawal guards. Each of these exists because skipping it loses
 * money — a malformed destination is unrecoverable once submitted, and a
 * destination without a USDC trustline produces a *failed transaction* on
 * Stellar rather than a bounce.
 */
describe('MerchantSettlementService.withdraw', () => {
  const DEST = 'GBBN5WUDNH5P7ZG3CKJIWZ6CXQY2PXL23H2K36QIE53UGAXWZDWJP3D7';
  const ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

  let service: MerchantSettlementService;

  const prisma = {
    merchantSettlementKey: { findUnique: jest.fn() },
    settlementWithdrawal: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const config = {
    get: jest.fn((k: string) =>
      k === 'STELLAR_NETWORK' ? 'testnet' : undefined,
    ),
  };

  const balances = (opts: { usdc?: string }) => [
    { asset_type: 'native', balance: '100' },
    ...(opts.usdc
      ? [{ asset_code: 'USDC', asset_issuer: ISSUER, balance: opts.usdc }]
      : []),
  ];

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MerchantSettlementService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get(MerchantSettlementService);

    prisma.merchantSettlementKey.findUnique.mockResolvedValue({
      merchantId: 'm1',
      stellarAddress: 'GSOURCE',
      managed: true,
      encryptedSeed: 'x',
      iv: 'y',
      authTag: 'z',
    });
    prisma.settlementWithdrawal.create.mockResolvedValue({
      id: 'w1',
      createdAt: new Date(),
    });
    prisma.settlementWithdrawal.update.mockResolvedValue({
      id: 'w1',
      createdAt: new Date(),
    });
  });

  it('rejects a destination that is not a Stellar public key', async () => {
    await expect(
      service.withdraw('m1', { destinationAddress: '0xdeadbeef', amount: '1' }),
    ).rejects.toThrow(/valid Stellar public key/);
  });

  it('rejects an asset other than USDC', async () => {
    await expect(
      service.withdraw('m1', {
        destinationAddress: DEST,
        amount: '1',
        asset: 'XLM' as 'USDC',
      }),
    ).rejects.toThrow(/Only USDC/);
  });

  it('refuses a self-custodied wallet, which has no seed to sign with', async () => {
    prisma.merchantSettlementKey.findUnique.mockResolvedValue({
      merchantId: 'm1',
      stellarAddress: 'CSMARTWALLET',
      managed: false,
      encryptedSeed: null,
    });

    await expect(
      service.withdraw('m1', { destinationAddress: DEST, amount: '1' }),
    ).rejects.toThrow(/self-custodied/);
  });

  it('refuses more than the USDC balance, ignoring XLM entirely', async () => {
    // Draining XLM would drop the account below its reserve and freeze it.
    (service as unknown as { horizon: unknown }).horizon = {
      loadAccount: jest
        .fn()
        .mockResolvedValue({ balances: balances({ usdc: '5' }) }),
    };

    await expect(
      service.withdraw('m1', { destinationAddress: DEST, amount: '50' }),
    ).rejects.toThrow(/Insufficient USDC: balance is 5/);
  });

  it('refuses a destination with no USDC trustline', async () => {
    (service as unknown as { horizon: unknown }).horizon = {
      loadAccount: jest
        .fn()
        .mockResolvedValueOnce({ balances: balances({ usdc: '50' }) })
        .mockResolvedValueOnce({ balances: balances({}) }),
    };

    await expect(
      service.withdraw('m1', { destinationAddress: DEST, amount: '10' }),
    ).rejects.toThrow(/must have a USDC trustline/);
  });

  it('refuses a destination account that does not exist yet', async () => {
    (service as unknown as { horizon: unknown }).horizon = {
      loadAccount: jest
        .fn()
        .mockResolvedValueOnce({ balances: balances({ usdc: '50' }) })
        .mockRejectedValueOnce(new Error('404')),
    };

    await expect(
      service.withdraw('m1', { destinationAddress: DEST, amount: '10' }),
    ).rejects.toThrow(/does not exist on Stellar/);
  });

  it('refuses a zero or negative amount', async () => {
    (service as unknown as { horizon: unknown }).horizon = {
      loadAccount: jest
        .fn()
        .mockResolvedValue({ balances: balances({ usdc: '5' }) }),
    };

    await expect(
      service.withdraw('m1', { destinationAddress: DEST, amount: '0' }),
    ).rejects.toThrow(/greater than zero/);
  });

  it('managed path refuses a self-custodied wallet, pointing at prepare/submit', async () => {
    prisma.merchantSettlementKey.findUnique.mockResolvedValue({
      merchantId: 'm1',
      stellarAddress: 'GSOURCE',
      smartWalletAddress:
        'CDKAIND4CJUC4SNVLSXS5CH5GOMNQPBU4F6I2DY4ZFNO7LKP4HM3YAIK',
      managed: false,
      encryptedSeed: null,
    });
    (service as unknown as { horizon: unknown }).horizon = {
      loadAccount: jest
        .fn()
        .mockResolvedValueOnce({ balances: balances({ usdc: '50' }) })
        .mockResolvedValueOnce({ balances: balances({ usdc: '0' }) }),
    };

    await expect(
      service.withdraw('m1', { destinationAddress: DEST, amount: '10' }),
    ).rejects.toThrow(/prepare\/submit/);
  });

  describe('submitWithdrawal', () => {
    it('refuses a withdrawal id belonging to another merchant', async () => {
      // Otherwise one merchant could broadcast against another's audit row.
      prisma.settlementWithdrawal.findUnique.mockResolvedValue({
        id: 'w1',
        merchantId: 'someone-else',
        status: 'prepared',
      });

      await expect(
        service.submitWithdrawal('m1', 'w1', 'AAAA'),
      ).rejects.toThrow(/not found/i);
    });

    it('refuses a withdrawal that was already submitted', async () => {
      prisma.settlementWithdrawal.findUnique.mockResolvedValue({
        id: 'w1',
        merchantId: 'm1',
        status: 'submitted',
      });

      await expect(
        service.submitWithdrawal('m1', 'w1', 'AAAA'),
      ).rejects.toThrow(/only a prepared withdrawal/i);
    });

    it('refuses an unparseable signed transaction', async () => {
      prisma.settlementWithdrawal.findUnique.mockResolvedValue({
        id: 'w1',
        merchantId: 'm1',
        status: 'prepared',
      });
      prisma.merchantSettlementKey.findUnique.mockResolvedValue({
        merchantId: 'm1',
        stellarAddress: 'GSOURCE',
        smartWalletAddress: null,
        managed: false,
      });

      await expect(
        service.submitWithdrawal('m1', 'w1', 'not-xdr'),
      ).rejects.toThrow(/not a valid transaction/i);
    });
  });

  it('records a failed withdrawal rather than leaving no trace', async () => {
    // A withdrawal that vanishes mid-flight must leave a record saying so.
    (service as unknown as { horizon: unknown }).horizon = {
      loadAccount: jest
        .fn()
        .mockResolvedValueOnce({ balances: balances({ usdc: '50' }) })
        .mockResolvedValueOnce({ balances: balances({ usdc: '0' }) })
        .mockRejectedValue(new Error('horizon exploded')),
    };

    await expect(
      service.withdraw('m1', { destinationAddress: DEST, amount: '10' }),
    ).rejects.toThrow(/could not be submitted/);

    expect(prisma.settlementWithdrawal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'failed' }),
      }),
    );
  });
});
