/**
 * Route-policy tests for RouterService.
 *
 * Replaces the old bridge-router.spec.ts (which exercised the same
 * `findRoute` semantics under the legacy BridgeRouterService). The
 * algorithm is unchanged; only the injection target moved.
 */

import { RouterService } from './router.service';

describe('cctp/RouterService.findRoute', () => {
  let router: RouterService;
  beforeEach(() => {
    router = new RouterService();
  });

  describe('same-chain Stellar', () => {
    it('routes via stellar_native — no bridge involved', () => {
      const route = router.findRoute('stellar', 'stellar', 'USDC');
      expect(route.provider).toBe('stellar_native');
      expect(route.estimatedTimeMs).toBe(5000);
      expect(route.estimatedFeeBps).toBe(0);
    });

    it('routes stellar_native for non-USDC same-chain too (EURC, XLM)', () => {
      expect(router.findRoute('stellar', 'stellar', 'EURC').provider).toBe(
        'stellar_native',
      );
      expect(router.findRoute('stellar', 'stellar', 'XLM').provider).toBe(
        'stellar_native',
      );
    });
  });

  describe('USDC cross-chain via CCTP V2', () => {
    it('Ethereum → Stellar (USDC) → cctp_v2', () => {
      const route = router.findRoute('ethereum', 'stellar', 'USDC');
      expect(route.provider).toBe('cctp_v2');
      expect(route.estimatedTimeMs).toBeLessThanOrEqual(20_000);
      expect(route.estimatedFeeBps).toBe(0);
    });

    it('Stellar → Ethereum (USDC) → cctp_v2 (symmetric)', () => {
      expect(router.findRoute('stellar', 'ethereum', 'USDC').provider).toBe(
        'cctp_v2',
      );
    });

    it('Base → Polygon (USDC, EVM-to-EVM) → cctp_v2', () => {
      expect(router.findRoute('base', 'polygon', 'USDC').provider).toBe(
        'cctp_v2',
      );
    });

    it('Avalanche → Arbitrum (USDC) → cctp_v2', () => {
      expect(router.findRoute('avalanche', 'arbitrum', 'USDC').provider).toBe(
        'cctp_v2',
      );
    });

    it('same chain on both sides falls through (not cctp_v2)', () => {
      expect(router.findRoute('ethereum', 'ethereum', 'USDC').provider).not.toBe(
        'cctp_v2',
      );
    });

    it('disabled chain in registry falls through (Solana registered but disabled)', () => {
      expect(router.findRoute('solana', 'stellar', 'USDC').provider).not.toBe(
        'cctp_v2',
      );
    });

    it('unknown chain falls through to legacy wormhole branch', () => {
      expect(router.findRoute('mystery', 'stellar', 'USDC').provider).toBe(
        'wormhole',
      );
    });
  });

  describe('non-USDC cross-chain', () => {
    it('does NOT route EURC via cctp_v2 (CCTP is USDC-only)', () => {
      expect(router.findRoute('ethereum', 'stellar', 'EURC').provider).not.toBe(
        'cctp_v2',
      );
    });

    it('does NOT route XLM via cctp_v2', () => {
      expect(router.findRoute('ethereum', 'stellar', 'XLM').provider).not.toBe(
        'cctp_v2',
      );
    });
  });

  describe('legacy fall-throughs (executors deleted in PR D)', () => {
    it('Starknet routes via layerswap (flip starknet.enabled to upgrade)', () => {
      expect(router.findRoute('starknet', 'stellar', 'USDC').provider).toBe(
        'layerswap',
      );
      expect(router.findRoute('stellar', 'starknet', 'USDC').provider).toBe(
        'layerswap',
      );
    });

    it('anything else surfaces as wormhole (no executor → fails at dispatch, by design)', () => {
      expect(router.findRoute('solana', 'aptos', 'USDC').provider).toBe(
        'wormhole',
      );
    });
  });

  describe('output shape contract', () => {
    it('always echoes from/to/asset', () => {
      const r = router.findRoute('ethereum', 'stellar', 'USDC');
      expect(r.fromChain).toBe('ethereum');
      expect(r.toChain).toBe('stellar');
      expect(r.asset).toBe('USDC');
    });

    it('always returns a finite, non-negative timing estimate', () => {
      const r = router.findRoute('ethereum', 'stellar', 'USDC');
      expect(Number.isFinite(r.estimatedTimeMs)).toBe(true);
      expect(r.estimatedTimeMs).toBeGreaterThanOrEqual(0);
    });
  });
});
