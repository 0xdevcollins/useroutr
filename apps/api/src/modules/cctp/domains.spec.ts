import {
  DOMAINS,
  enabledDomains,
  getDomain,
  getDomainByNumber,
  isEnabled,
} from './domains';

describe('cctp/domains', () => {
  it('exposes Stellar as Domain 27, mainnet-enabled', () => {
    const stellar = getDomain('stellar');
    expect(stellar).toBeDefined();
    expect(stellar?.domain).toBe(27);
    expect(stellar?.kind).toBe('stellar');
    expect(stellar?.enabled).toBe(true);
  });

  it('exposes Ethereum as Domain 0, mainnet-enabled', () => {
    expect(getDomain('ethereum')?.domain).toBe(0);
  });

  it('round-trips id ↔ domain number for every registered chain', () => {
    for (const entry of DOMAINS) {
      const found = getDomainByNumber(entry.domain);
      expect(found?.id).toBe(entry.id);
    }
  });

  it('returns undefined for unknown id', () => {
    expect(getDomain('mystery-chain')).toBeUndefined();
    expect(getDomainByNumber(999)).toBeUndefined();
  });

  it('isEnabled reflects the enabled flag', () => {
    expect(isEnabled('stellar')).toBe(true);
    // Solana is in the registry but flagged disabled (not routed yet).
    expect(isEnabled('solana')).toBe(false);
    expect(isEnabled('mystery-chain')).toBe(false);
  });

  it('enabledDomains() returns only flagged-enabled entries', () => {
    const ids = enabledDomains().map((d) => d.id);
    expect(ids).toContain('stellar');
    expect(ids).toContain('ethereum');
    expect(ids).not.toContain('solana');
  });

  it('every domain number is unique', () => {
    const numbers = DOMAINS.map((d) => d.domain);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it('every domain id is unique', () => {
    const ids = DOMAINS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
