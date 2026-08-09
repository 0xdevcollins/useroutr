import { Test, TestingModule } from '@nestjs/testing';
import * as StellarSdk from '@stellar/stellar-sdk';
import { StellarService } from './stellar.service';

/**
 * Verifying a payment into a Soroban contract address.
 *
 * A contract cannot receive a classic payment operation, so the Horizon path
 * finds nothing for a smart-wallet merchant — it would reject a payment that
 * genuinely arrived. That fails closed on real money, which is why this is
 * checked against real ScVal event structures rather than stubbed shapes.
 */
describe('StellarService.verifyIncomingPayment — contract destination', () => {
  const CONTRACT = 'CDKAIND4CJUC4SNVLSXS5CH5GOMNQPBU4F6I2DY4ZFNO7LKP4HM3YAIK';
  const OTHER = 'CBA5J6RFHS3G26FWMFNCICCAXBQUAWCMB5JT5UTAVIJUQTCHWJRPCVFM';
  const FROM = 'GBBN5WUDNH5P7ZG3CKJIWZ6CXQY2PXL23H2K36QIE53UGAXWZDWJP3D7';

  let service: StellarService;

  /** A real SAC `transfer` event: topics [symbol, from, to, asset], data i128. */
  const transferEvent = (to: string, stroops: bigint) => ({
    body: () => ({
      v0: () => ({
        topics: () => [
          StellarSdk.nativeToScVal('transfer', { type: 'symbol' }),
          new StellarSdk.Address(FROM).toScVal(),
          new StellarSdk.Address(to).toScVal(),
          StellarSdk.nativeToScVal('USDC', { type: 'string' }),
        ],
        data: () => StellarSdk.nativeToScVal(stroops, { type: 'i128' }),
      }),
    }),
  });

  const withEvents = (events: unknown[]) => ({
    status: StellarSdk.rpc.Api.GetTransactionStatus.SUCCESS,
    resultMetaXdr: {
      v3: () => ({ sorobanMeta: () => ({ events: () => events }) }),
    },
  });

  const stubRpc = (response: unknown) => {
    (service as unknown as { sorobanServer: unknown }).sorobanServer = {
      getTransaction: jest.fn().mockResolvedValue(response),
    };
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StellarService],
    }).compile();
    service = module.get(StellarService);
  });

  const verify = (minAmount: string) =>
    service.verifyIncomingPayment({
      txHash: 'a'.repeat(64),
      destination: CONTRACT,
      minAmount,
      assetCode: 'USDC',
    });

  it('accepts a transfer of the expected amount', async () => {
    stubRpc(withEvents([transferEvent(CONTRACT, 50_000_000n)]));
    await expect(verify('5')).resolves.toEqual({ ok: true });
  });

  it('sums multiple transfers to the same destination', async () => {
    stubRpc(
      withEvents([
        transferEvent(CONTRACT, 20_000_000n),
        transferEvent(CONTRACT, 30_000_000n),
      ]),
    );
    await expect(verify('5')).resolves.toEqual({ ok: true });
  });

  it('ignores transfers to a different contract', async () => {
    stubRpc(withEvents([transferEvent(OTHER, 50_000_000n)]));
    await expect(verify('5')).resolves.toMatchObject({
      ok: false,
      reason: expect.stringContaining('no transfer'),
    });
  });

  it('rejects an underpayment rather than settling short', async () => {
    stubRpc(withEvents([transferEvent(CONTRACT, 1_000_000n)]));
    await expect(verify('5')).resolves.toMatchObject({
      ok: false,
      reason: expect.stringContaining('expected at least'),
    });
  });

  it('rejects a transaction that did not succeed', async () => {
    stubRpc({
      status: StellarSdk.rpc.Api.GetTransactionStatus.FAILED,
      resultMetaXdr: undefined,
    });
    await expect(verify('5')).resolves.toMatchObject({ ok: false });
  });

  it('treats an unreachable RPC as unverified, not as verified', async () => {
    (service as unknown as { sorobanServer: unknown }).sorobanServer = {
      getTransaction: jest.fn().mockRejectedValue(new Error('rpc down')),
    };
    await expect(verify('5')).resolves.toMatchObject({
      ok: false,
      reason: expect.stringContaining('not found'),
    });
  });

  it('ignores a malformed event instead of rejecting the whole transaction', async () => {
    stubRpc(
      withEvents([
        {
          body: () => ({
            v0: () => ({ topics: () => null, data: () => null }),
          }),
        },
        transferEvent(CONTRACT, 50_000_000n),
      ]),
    );
    await expect(verify('5')).resolves.toEqual({ ok: true });
  });
});
