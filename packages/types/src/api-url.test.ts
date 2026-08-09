import { describe, expect, it } from 'vitest';
import { API_VERSION, assertVersionlessPath, resolveApiBaseUrl } from './api-url';

/**
 * These cases are the bug that prompted this module, written down.
 *
 * Both spellings of the origin have to work, because the two apps that read
 * `NEXT_PUBLIC_API_URL` used to disagree about which one it was, and the
 * variable is set once per deployment.
 */
describe('resolveApiBaseUrl', () => {
  const fallback = 'http://localhost:3333';

  it('appends the version to a bare origin', () => {
    expect(resolveApiBaseUrl('https://api.useroutr.com', fallback)).toBe(
      'https://api.useroutr.com/v1',
    );
  });

  it('leaves an origin that already carries the version alone', () => {
    expect(resolveApiBaseUrl('https://api.useroutr.com/v1', fallback)).toBe(
      'https://api.useroutr.com/v1',
    );
  });

  it('tolerates trailing slashes on either spelling', () => {
    expect(resolveApiBaseUrl('https://api.useroutr.com/', fallback)).toBe(
      'https://api.useroutr.com/v1',
    );
    expect(resolveApiBaseUrl('https://api.useroutr.com/v1/', fallback)).toBe(
      'https://api.useroutr.com/v1',
    );
  });

  // Someone who has already been bitten by the doubled prefix may well "fix"
  // it by pasting the doubled value into the env var. Repair it rather than
  // faithfully reproduce it.
  it('collapses an origin that already doubled the version', () => {
    expect(resolveApiBaseUrl('https://api.useroutr.com/v1/v1', fallback)).toBe(
      'https://api.useroutr.com/v1',
    );
  });

  it('falls back when the variable is unset, empty or whitespace', () => {
    expect(resolveApiBaseUrl(undefined, fallback)).toBe(`${fallback}/v1`);
    expect(resolveApiBaseUrl(null, fallback)).toBe(`${fallback}/v1`);
    expect(resolveApiBaseUrl('', fallback)).toBe(`${fallback}/v1`);
    expect(resolveApiBaseUrl('   ', fallback)).toBe(`${fallback}/v1`);
  });

  it('preserves a path prefix in front of the version, for ingress setups', () => {
    expect(resolveApiBaseUrl('https://useroutr.com/api', fallback)).toBe(
      'https://useroutr.com/api/v1',
    );
  });

  it('never returns a base that lacks exactly one version segment', () => {
    for (const input of [
      'https://x.com',
      'https://x.com/',
      'https://x.com/v1',
      'https://x.com/v1/',
      'https://x.com/v1/v1',
    ]) {
      const matches = resolveApiBaseUrl(input, fallback).match(
        new RegExp(`/${API_VERSION}`, 'g'),
      );
      expect(matches).toHaveLength(1);
    }
  });
});

describe('assertVersionlessPath', () => {
  it('rejects a path that re-adds the version', () => {
    expect(() => assertVersionlessPath('/v1/payouts')).toThrow(/already includes it/);
  });

  it('names the path the caller should have written', () => {
    expect(() => assertVersionlessPath('/v1/invoices/abc')).toThrow(
      /Pass "\/invoices\/abc" instead/,
    );
  });

  it('rejects the bare version segment', () => {
    expect(() => assertVersionlessPath('/v1')).toThrow();
  });

  it('allows ordinary resource paths', () => {
    expect(() => assertVersionlessPath('/payouts')).not.toThrow();
    expect(() => assertVersionlessPath('/invoices/abc/pdf')).not.toThrow();
  });

  // The guard must not fire on a resource whose name merely starts with "v1".
  it('does not confuse a resource prefixed with the version string', () => {
    expect(() => assertVersionlessPath('/v1beta/experiments')).not.toThrow();
  });
});
