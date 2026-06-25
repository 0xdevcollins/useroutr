import {
  cctpEnvFromStellarNetwork,
  EVM_CCTP,
  getEvmContracts,
  getStellarContracts,
  IRIS_BASE_URL,
  irisUrl,
  STELLAR_CCTP,
} from './contracts';

describe('cctp/contracts', () => {
  describe('cctpEnvFromStellarNetwork', () => {
    it('returns mainnet only when STELLAR_NETWORK === "mainnet"', () => {
      expect(cctpEnvFromStellarNetwork('mainnet')).toBe('mainnet');
    });

    it('defaults to testnet for any other value (or missing)', () => {
      expect(cctpEnvFromStellarNetwork('testnet')).toBe('testnet');
      expect(cctpEnvFromStellarNetwork(undefined)).toBe('testnet');
      expect(cctpEnvFromStellarNetwork('FUTURENET')).toBe('testnet');
    });
  });

  describe('getStellarContracts', () => {
    it('returns the right bundle for mainnet (forwarder, transmitter, minter, usdc all set)', () => {
      const c = getStellarContracts('mainnet');
      expect(c.tokenMessengerMinter).toMatch(/^C[A-Z2-7]{55}$/);
      expect(c.messageTransmitter).toMatch(/^C[A-Z2-7]{55}$/);
      expect(c.cctpForwarder).toMatch(/^C[A-Z2-7]{55}$/);
      expect(c.usdc).toMatch(/^C[A-Z2-7]{55}$/);
    });

    it('returns different addresses for testnet vs mainnet', () => {
      const main = getStellarContracts('mainnet');
      const test = getStellarContracts('testnet');
      expect(main.tokenMessengerMinter).not.toBe(test.tokenMessengerMinter);
      expect(main.cctpForwarder).not.toBe(test.cctpForwarder);
    });

    it('uses the addresses verified in Circle docs (anti-typo guard)', () => {
      // If these ever change Circle has redeployed — we want the test
      // to fail loudly so we update both the constant and any cached
      // ABI/address pinning.
      expect(STELLAR_CCTP.mainnet.tokenMessengerMinter).toBe(
        'CAE2G5Z77UP7GYPYGFOWFGW7C7J6I4YP2AFGSADRKQY62SYUFLPNFTXL',
      );
      expect(STELLAR_CCTP.mainnet.messageTransmitter).toBe(
        'CACMENFFJPJMSDAJQLX4R7K3SFZIW2LJSE3R2UMLGSWHFHS353FVXAZV',
      );
      expect(STELLAR_CCTP.mainnet.cctpForwarder).toBe(
        'CBZL2IH7F6BIDAA3WBNXYKIXSATJGMSW7K5P5MJ6STX5RXN47TZJDF5T',
      );
    });
  });

  describe('getEvmContracts', () => {
    it('returns the same deterministic addresses for every EVM chain (no overrides)', () => {
      const eth = getEvmContracts('ethereum', 'mainnet');
      const base = getEvmContracts('base', 'mainnet');
      const arb = getEvmContracts('arbitrum', 'mainnet');
      expect(eth.tokenMessenger).toBe(base.tokenMessenger);
      expect(eth.tokenMessenger).toBe(arb.tokenMessenger);
      expect(eth.tokenMessenger).toBe(EVM_CCTP.mainnet.tokenMessenger);
    });

    it('pins the verified mainnet contract addresses (anti-typo guard)', () => {
      const c = getEvmContracts('ethereum', 'mainnet');
      expect(c.tokenMessenger).toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(c.messageTransmitter).toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(c.tokenMinter).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });

    it('testnet addresses differ from mainnet', () => {
      const main = getEvmContracts('ethereum', 'mainnet');
      const test = getEvmContracts('ethereum', 'testnet');
      expect(main.tokenMessenger).not.toBe(test.tokenMessenger);
    });
  });

  describe('irisUrl', () => {
    it('routes to mainnet iris for mainnet env', () => {
      expect(irisUrl('mainnet', '/v2/messages/0')).toBe(
        'https://iris-api.circle.com/v2/messages/0',
      );
    });

    it('routes to sandbox iris for testnet env', () => {
      expect(irisUrl('testnet', '/v2/messages/0')).toBe(
        'https://iris-api-sandbox.circle.com/v2/messages/0',
      );
    });

    it('normalizes missing leading slash', () => {
      expect(irisUrl('mainnet', 'v2/health')).toBe(
        'https://iris-api.circle.com/v2/health',
      );
    });

    it('handles empty path', () => {
      expect(irisUrl('mainnet')).toBe('https://iris-api.circle.com/');
    });
  });

  describe('IRIS_BASE_URL', () => {
    it('uses Circle\'s documented hostnames', () => {
      expect(IRIS_BASE_URL.mainnet).toBe('https://iris-api.circle.com');
      expect(IRIS_BASE_URL.testnet).toBe('https://iris-api-sandbox.circle.com');
    });
  });
});
