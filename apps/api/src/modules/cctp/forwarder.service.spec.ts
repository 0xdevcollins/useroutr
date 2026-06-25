import type { ConfigService } from '@nestjs/config';
import { ForwarderService } from './forwarder.service';

function makeConfig(overrides: Record<string, string | undefined> = {}) {
  return {
    get: jest.fn((key: string) => overrides[key]),
  } as unknown as ConfigService;
}

describe('ForwarderService', () => {
  describe('evmForwardSentinel', () => {
    it('returns the documented Circle "cctp-forward" magic value', () => {
      const svc = new ForwarderService(makeConfig());
      // "cctp-forward" as UTF-8 = 63 63 74 70 2d 66 6f 72 77 61 72 64,
      // right-padded with zeros to 32 bytes.
      expect(svc.evmForwardSentinel()).toBe(
        '0x636374702d666f72776172640000000000000000000000000000000000000000',
      );
    });

    it('is exactly 32 bytes (64 hex chars after the 0x prefix)', () => {
      const svc = new ForwarderService(makeConfig());
      const hex = svc.evmForwardSentinel().slice(2);
      expect(hex.length).toBe(64);
    });
  });

  describe('encodeStellarForwardHook', () => {
    it('encodes a G... strkey into the documented layout', () => {
      const svc = new ForwarderService(makeConfig());
      // Real-shape G strkey (56 chars). Doesn't have to be a live account
      // for the test — we just want byte-layout verification.
      const strkey = 'GAOVELQKDL5OD2WWBMKVA3EQVW2VGTOWDWUTDIBSXCWBFTK3JIDGJ6FJ';
      const hex = svc.encodeStellarForwardHook(strkey);
      const buf = Buffer.from(hex.slice(2), 'hex');

      // bytes 0..23: zero padding
      expect(buf.slice(0, 24).every((b) => b === 0)).toBe(true);
      // bytes 24..27: hook version 0 (uint32 big-endian)
      expect(buf.readUInt32BE(24)).toBe(0);
      // bytes 28..31: recipient length (56)
      expect(buf.readUInt32BE(28)).toBe(56);
      // bytes 32..(32+56): the strkey itself, UTF-8
      expect(buf.slice(32).toString('utf8')).toBe(strkey);
    });

    it('accepts contract strkey (C...) the same way', () => {
      const svc = new ForwarderService(makeConfig());
      const strkey = 'CBZL2IH7F6BIDAA3WBNXYKIXSATJGMSW7K5P5MJ6STX5RXN47TZJDF5T';
      const buf = Buffer.from(svc.encodeStellarForwardHook(strkey).slice(2), 'hex');
      expect(buf.readUInt32BE(28)).toBe(56);
      expect(buf.slice(32).toString('utf8')).toBe(strkey);
    });

    it('rejects EVM addresses', () => {
      const svc = new ForwarderService(makeConfig());
      expect(() =>
        svc.encodeStellarForwardHook('0xdeadbeef00000000000000000000000000000000'),
      ).toThrow(/Stellar strkey/);
    });

    it('rejects wrong-length strings', () => {
      const svc = new ForwarderService(makeConfig());
      expect(() => svc.encodeStellarForwardHook('GTOOSHORT')).toThrow(
        /56 chars/,
      );
    });

    it('rejects strkeys with invalid prefix', () => {
      const svc = new ForwarderService(makeConfig());
      // 56 chars but starts with X — not a valid Stellar key prefix.
      const bad = 'X' + 'A'.repeat(55);
      expect(() => svc.encodeStellarForwardHook(bad)).toThrow(/G, C, or M/);
    });
  });
});
