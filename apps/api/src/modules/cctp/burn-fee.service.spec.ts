import type { ConfigService } from '@nestjs/config';
import {
  BurnFeeService,
  FINALITY_FAST,
  FINALITY_STANDARD,
} from './burn-fee.service';

function makeService(network = 'testnet') {
  return new BurnFeeService({
    get: jest.fn((key: string) =>
      key === 'STELLAR_NETWORK' ? network : undefined,
    ),
  } as unknown as ConfigService);
}

function mockFetch(impl: () => Promise<unknown>) {
  global.fetch = jest.fn(impl) as unknown as typeof fetch;
}

/** Circle's real shape for Ethereum → Stellar at the time of writing. */
const CIRCLE_FEES = [
  { finalityThreshold: 1000, minimumFee: 1 },
  { finalityThreshold: 2000, minimumFee: 0 },
];

const ok = (body: unknown) =>
  Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });

describe('BurnFeeService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('maxFeeFor', () => {
    const svc = makeService();

    // The bug this guards. A 0.01 USDC payment is 10_000 subunits; 1 bp of it
    // is exactly 1 subunit. Anything smaller truncates toward zero, and a
    // maxFee of 0 is precisely the "insufficient fee" that gets a Fast
    // Transfer silently demoted to a fifteen-minute one.
    it('never returns zero for a non-zero rate', () => {
      expect(svc.maxFeeFor(10_000n, 1)).toBe(1n);
      expect(svc.maxFeeFor(1n, 1)).toBe(1n);
      expect(svc.maxFeeFor(100n, 1)).toBe(1n);
    });

    it('rounds up rather than down', () => {
      // 1 bp of 15_001 subunits is 1.5001 — must not floor to 1.
      expect(svc.maxFeeFor(15_001n, 1)).toBe(2n);
    });

    it('computes whole-basis-point amounts exactly', () => {
      expect(svc.maxFeeFor(1_000_000n, 1)).toBe(100n); // 1 USDC, 1bp
      expect(svc.maxFeeFor(1_000_000n, 14)).toBe(1400n);
    });

    it('is zero only when the rate itself is', () => {
      expect(svc.maxFeeFor(1_000_000n, 0)).toBe(0n);
    });
  });

  describe('minimumFeeBps', () => {
    it("returns Circle's quoted rate for the fast tier", async () => {
      mockFetch(() => ok(CIRCLE_FEES));
      await expect(
        makeService().minimumFeeBps(0, 27, FINALITY_FAST),
      ).resolves.toBe(1);
    });

    it('returns the free rate for standard finality', async () => {
      mockFetch(() => ok(CIRCLE_FEES));
      await expect(
        makeService().minimumFeeBps(0, 27, FINALITY_STANDARD),
      ).resolves.toBe(0);
    });

    it('queries the sandbox on testnet and the live API on mainnet', async () => {
      mockFetch(() => ok(CIRCLE_FEES));
      await makeService('testnet').minimumFeeBps(0, 27);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://iris-api-sandbox.circle.com/v2/burn/USDC/fees/0/27',
        expect.anything(),
      );

      mockFetch(() => ok(CIRCLE_FEES));
      await makeService('mainnet').minimumFeeBps(0, 27);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://iris-api.circle.com/v2/burn/USDC/fees/0/27',
        expect.anything(),
      );
    });

    // Null means "fall back to standard finality". Returning 0 instead would
    // read as "fast is free" and send a burn that gets demoted anyway — the
    // exact failure this service exists to prevent.
    it('returns null when Circle errors', async () => {
      mockFetch(() =>
        Promise.resolve({
          ok: false,
          status: 503,
          json: () => Promise.resolve({}),
        }),
      );
      await expect(makeService().minimumFeeBps(0, 27)).resolves.toBeNull();
    });

    it('returns null when the request fails outright', async () => {
      mockFetch(() => Promise.reject(new Error('network down')));
      await expect(makeService().minimumFeeBps(0, 27)).resolves.toBeNull();
    });

    it('returns null when the tier is not quoted for the route', async () => {
      mockFetch(() => ok([{ finalityThreshold: 2000, minimumFee: 0 }]));
      await expect(
        makeService().minimumFeeBps(0, 27, FINALITY_FAST),
      ).resolves.toBeNull();
    });

    it('caches per route so a burn does not re-query on every quote', async () => {
      mockFetch(() => ok(CIRCLE_FEES));
      const svc = makeService();

      await svc.minimumFeeBps(0, 27);
      await svc.minimumFeeBps(0, 27);

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('does not let one route cache-poison another', async () => {
      mockFetch(() => ok(CIRCLE_FEES));
      const svc = makeService();

      await svc.minimumFeeBps(0, 27);
      await svc.minimumFeeBps(6, 27);

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });
});
