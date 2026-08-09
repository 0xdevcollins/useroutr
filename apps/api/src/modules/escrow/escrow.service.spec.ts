import { EscrowService } from './escrow.service';

/**
 * Configuration and argument-shaping only. The Soroban round-trip is covered
 * on-chain by the contract's own 51 tests and by the testnet smoke run; what
 * can go wrong *here* is calling the contract with the wrong parties or with
 * half the config missing, and failing in a way nobody can diagnose.
 */
describe('EscrowService', () => {
  const ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ENV };
  });

  const configure = (overrides: Record<string, string | undefined> = {}) => {
    process.env = {
      ...ENV,
      STELLAR_NETWORK: 'testnet',
      SOROBAN_ESCROW_CONTRACT_ID:
        'CDKAIND4CJUC4SNVLSXS5CH5GOMNQPBU4F6I2DY4ZFNO7LKP4HM3YAIK',
      // Two distinct keys: the contract rejects an arbiter that is also a
      // beneficiary, so relay and holding must never be the same account.
      // Throwaway keypairs generated for this spec — never funded, never used
      // anywhere else. Real strkeys are required because fromSecret verifies
      // the checksum.
      STELLAR_RELAY_KEYPAIR_SECRET:
        'SDTVGDE2OGARVNWNJ6OXZYGOAHG2M54NA3AKQCHI5CJC3E57TK767LVL',
      STELLAR_ESCROW_HOLDING_SECRET:
        'SAUCSNGXAWHAYAJWWKJKAYT3DZXWDXW2SSIATXX6B5YDWRI6APEFTQF4',
      ...overrides,
    } as NodeJS.ProcessEnv;
    return new EscrowService();
  };

  it('reports configured only when contract id and both keys are present', () => {
    expect(configure().isConfigured()).toBe(true);
  });

  it.each([
    ['SOROBAN_ESCROW_CONTRACT_ID'],
    ['STELLAR_RELAY_KEYPAIR_SECRET'],
    ['STELLAR_ESCROW_HOLDING_SECRET'],
  ])('is not configured when %s is missing', (missing) => {
    const svc = configure({ [missing]: undefined });
    expect(svc.isConfigured()).toBe(false);
  });

  it('names the missing variable when asked to act unconfigured', async () => {
    const svc = configure({ STELLAR_ESCROW_HOLDING_SECRET: undefined });

    // A silent no-op here would mean funds quietly not being escrowed for a
    // merchant who opted in — the failure has to be loud and specific.
    await expect(svc.release('deadbeef')).rejects.toThrow(
      /STELLAR_ESCROW_HOLDING_SECRET/,
    );
  });

  it('keeps the holding account distinct from the arbiter', () => {
    const svc = configure();

    expect(svc.holdingAddress).toBeTruthy();
    expect(svc.arbiterAddress).toBeTruthy();
    // The contract enforces this too, but failing here is far cheaper than
    // discovering it in a reverted transaction.
    expect(svc.holdingAddress).not.toBe(svc.arbiterAddress);
  });

  it('rejects a split that does not sum to 10000 before touching the network', async () => {
    const svc = configure();

    await expect(svc.resolve('deadbeef', 3000, 6000)).rejects.toThrow(
      /must equal 10000/,
    );
  });

  it('is unconfigured, not crashing, when nothing is set at all', () => {
    process.env = { ...ENV } as NodeJS.ProcessEnv;
    delete process.env.SOROBAN_ESCROW_CONTRACT_ID;
    delete process.env.STELLAR_RELAY_KEYPAIR_SECRET;
    delete process.env.STELLAR_ESCROW_HOLDING_SECRET;

    // Constructing must not throw: the module is always loaded, escrow is
    // merely unavailable until someone configures it.
    const svc = new EscrowService();
    expect(svc.isConfigured()).toBe(false);
    expect(svc.holdingAddress).toBeNull();
  });
});
