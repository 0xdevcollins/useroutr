import type { ConfigService } from '@nestjs/config';
import { EvmCctpClient } from './evm-cctp.client';

function makeConfig(overrides: Record<string, string | undefined> = {}) {
  return {
    get: jest.fn((key: string) => overrides[key]),
  } as unknown as ConfigService;
}

/**
 * Reaches the private URL resolver directly. The alternative is driving it
 * through `parseBurnReceipt`, which would build a real JsonRpcProvider and go
 * to the network — these cases are about which URL is chosen, not about
 * talking to it.
 */
function rpcUrlFor(client: EvmCctpClient, chainId: string): string {
  return (
    client as unknown as { rpcUrlFor(chainId: string): string }
  ).rpcUrlFor(chainId);
}

describe('EvmCctpClient RPC selection', () => {
  describe('on testnet', () => {
    const testnet = (overrides: Record<string, string | undefined> = {}) =>
      new EvmCctpClient(
        makeConfig({ STELLAR_NETWORK: 'testnet', ...overrides }),
      );

    // The regression this guards: a chain id is the same string on both
    // networks, so `RPC_ETHEREUM` — a mainnet URL — was being used to read
    // Sepolia contract addresses. Nothing is deployed at those addresses on
    // mainnet, so every testnet burn lookup failed.
    it('ignores the mainnet RPC and uses the public testnet endpoint', () => {
      const client = testnet({
        RPC_ETHEREUM: 'https://eth-mainnet.example/v2/key',
      });

      const url = rpcUrlFor(client, 'ethereum');

      expect(url).not.toContain('eth-mainnet');
      expect(url).toBe('https://ethereum-sepolia-rpc.publicnode.com');
    });

    it('prefers an explicit RPC_<CHAIN>_TESTNET over the public default', () => {
      const client = testnet({
        RPC_ETHEREUM_TESTNET: 'https://my-own-sepolia.example',
      });

      expect(rpcUrlFor(client, 'ethereum')).toBe(
        'https://my-own-sepolia.example',
      );
    });

    it.each([
      ['ethereum', 'https://ethereum-sepolia-rpc.publicnode.com'],
      ['base', 'https://sepolia.base.org'],
      ['arbitrum', 'https://sepolia-rollup.arbitrum.io/rpc'],
      ['optimism', 'https://sepolia.optimism.io'],
      ['avalanche', 'https://api.avax-test.network/ext/bc/C/rpc'],
    ])(
      'has a working default for %s so no key is needed',
      (chain, expected) => {
        expect(rpcUrlFor(testnet(), chain)).toBe(expected);
      },
    );

    it('names the variable to set for a chain with no default', () => {
      expect(() => rpcUrlFor(testnet(), 'polygon')).toThrow(
        /RPC_POLYGON_TESTNET/,
      );
    });
  });

  describe('on mainnet', () => {
    const mainnet = (overrides: Record<string, string | undefined> = {}) =>
      new EvmCctpClient(
        makeConfig({ STELLAR_NETWORK: 'mainnet', ...overrides }),
      );

    it('uses the configured per-chain RPC', () => {
      const client = mainnet({
        RPC_ETHEREUM: 'https://eth-mainnet.example/v2/key',
      });

      expect(rpcUrlFor(client, 'ethereum')).toBe(
        'https://eth-mainnet.example/v2/key',
      );
    });

    // Falling back to a public endpoint for real money would be a poor favour:
    // rate limits and an unaudited third party are not what you want moving
    // customer funds, and silence about it is worse.
    it('refuses to fall back to a public endpoint', () => {
      expect(() => rpcUrlFor(mainnet(), 'ethereum')).toThrow(/RPC_ETHEREUM/);
      expect(() => rpcUrlFor(mainnet(), 'ethereum')).not.toThrow(/publicnode/);
    });
  });
});
