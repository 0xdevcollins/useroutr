/**
 * Deployed CCTP contract addresses, per chain, per environment.
 *
 * For Stellar these are Soroban contract IDs (C... addresses). For EVM
 * chains they're 20-byte addresses. Sources:
 *  - Stellar: https://developers.circle.com/cctp/references/stellar-contracts
 *  - EVM:     https://developers.circle.com/cctp/references/evm-smart-contracts
 *
 * EVM CCTP V2 deployments are deterministic — the same address is used
 * on every supported EVM chain (CREATE2 with a constant salt). So the
 * EVM block below has a single set of addresses that apply to all
 * `kind: 'evm'` domains.
 */

export interface StellarCctpContracts {
  /** Burn USDC + emit cross-chain message. */
  tokenMessengerMinter: string;
  /** Send/receive messages. Used directly when bypassing the forwarder. */
  messageTransmitter: string;
  /**
   * Convenience wrapper. Use this for inbound mints to user accounts —
   * it atomically validates + mints + forwards in one call, so a failure
   * anywhere reverts the whole transaction (non-custodial).
   */
  cctpForwarder: string;
  /** USDC contract address (Soroban). */
  usdc: string;
}

export interface EvmCctpContracts {
  /** TokenMessengerV2 — entry point for `depositForBurn` / `depositForBurnWithHook`. */
  tokenMessenger: string;
  /** MessageTransmitterV2 — `receiveMessage` destination, attestation verifier. */
  messageTransmitter: string;
  /** TokenMinterV2 — internal to MessageTransmitter, exposed for reads. */
  tokenMinter: string;
}

export type CctpEnv = 'mainnet' | 'testnet';

interface StellarBundle {
  mainnet: StellarCctpContracts;
  testnet: StellarCctpContracts;
}

interface EvmBundle {
  mainnet: EvmCctpContracts;
  testnet: EvmCctpContracts;
}

/* ───────────────────────────────────────────────────── Stellar ────────────── */

export const STELLAR_CCTP: StellarBundle = {
  mainnet: {
    tokenMessengerMinter:
      'CAE2G5Z77UP7GYPYGFOWFGW7C7J6I4YP2AFGSADRKQY62SYUFLPNFTXL',
    messageTransmitter:
      'CACMENFFJPJMSDAJQLX4R7K3SFZIW2LJSE3R2UMLGSWHFHS353FVXAZV',
    cctpForwarder: 'CBZL2IH7F6BIDAA3WBNXYKIXSATJGMSW7K5P5MJ6STX5RXN47TZJDF5T',
    // Mainnet USDC issuer GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN
    // SAC-wrapped Soroban contract id for the same asset:
    usdc: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75',
  },
  testnet: {
    tokenMessengerMinter:
      'CDNG7HXAPBWICI2E3AUBP3YZWZELJLYSB6F5CC7WLDTLTHVM74SLRTHP',
    messageTransmitter:
      'CBJ6MTCKKZG73PMDZCJMSFRD7DQEMI4FKDH7CGDSV4W6FHCRBCQAVVJY',
    cctpForwarder: 'CA66Q2WFBND6V4UEB7RD4SAXSVIWMD6RA4X3U32ELVFGXV5PJK4T4VSZ',
    // Testnet USDC issuer GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
    usdc: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
  },
};

/* ───────────────────────────────────────────────────────── EVM ────────────── */

/**
 * CCTP V2 EVM addresses. Per Circle's deployment pattern, these are
 * identical across all V2-supported EVM chains because they use
 * deterministic CREATE2 deployment. If a chain ever deploys at a
 * different address (custom factory), override per-domain below.
 */
export const EVM_CCTP: EvmBundle = {
  mainnet: {
    tokenMessenger: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    messageTransmitter: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
    tokenMinter: '0xfd78EE919681417d192449715b2594ab58f5D002',
  },
  testnet: {
    // CCTP V2 testnet uses the same deterministic addresses across the
    // supported testnets. Confirmed against Sepolia / Base Sepolia /
    // Arbitrum Sepolia in Circle's docs.
    tokenMessenger: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    messageTransmitter: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
    tokenMinter: '0xb43db544E2c27092c107639Ad201b3dEfAbcF192',
  },
};

/**
 * Per-domain override, in case Circle ever deploys at a non-deterministic
 * address on a specific chain. Empty for now — the same addresses apply
 * to every EVM V2 deployment.
 */
export const EVM_OVERRIDES: Partial<
  Record<
    string,
    { mainnet?: Partial<EvmCctpContracts>; testnet?: Partial<EvmCctpContracts> }
  >
> = {};

/**
 * USDC contract address per EVM chain. CCTP V2 contracts are deterministic
 * across chains (above), but the underlying USDC token has different
 * deployment addresses per chain. Source of truth:
 *  - Mainnet: https://developers.circle.com/stablecoins/usdc-contract-addresses
 *  - Testnet: same page, "Testnet" tab
 *
 * Only the enabled-domain chains are populated. Disabled chains can be
 * added when their `enabled` flag flips in domains.ts.
 */
export const USDC_ADDRESSES: Record<
  string,
  { mainnet: string; testnet: string }
> = {
  ethereum: {
    mainnet: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    testnet: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Sepolia
  },
  avalanche: {
    mainnet: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    testnet: '0x5425890298aed601595a70AB815c96711a31Bc65', // Fuji
  },
  optimism: {
    mainnet: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    testnet: '0x5fd84259d66Cd46123540766Be93DFE6D43130D7', // OP Sepolia
  },
  arbitrum: {
    mainnet: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    testnet: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d', // Arb Sepolia
  },
  base: {
    mainnet: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    testnet: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia
  },
};

export function getUsdcAddress(chainId: string, env: CctpEnv): string {
  const entry = USDC_ADDRESSES[chainId];
  if (!entry) {
    throw new Error(`No USDC address registered for chain ${chainId}`);
  }
  return entry[env];
}

/* ────────────────────────────────────────────────── Iris API ─────────────── */

export const IRIS_BASE_URL: Record<CctpEnv, string> = {
  mainnet: 'https://iris-api.circle.com',
  testnet: 'https://iris-api-sandbox.circle.com',
};

/* ─────────────────────────────────────────────── helpers ─────────────────── */

/** Resolve the right environment for the configured Stellar network. */
export function cctpEnvFromStellarNetwork(
  network: string | undefined,
): CctpEnv {
  return network === 'mainnet' ? 'mainnet' : 'testnet';
}

export function getStellarContracts(env: CctpEnv): StellarCctpContracts {
  return STELLAR_CCTP[env];
}

export function getEvmContracts(
  chainId: string,
  env: CctpEnv,
): EvmCctpContracts {
  const override = EVM_OVERRIDES[chainId]?.[env];
  return { ...EVM_CCTP[env], ...override };
}

export function irisUrl(env: CctpEnv, path = ''): string {
  return `${IRIS_BASE_URL[env]}${path.startsWith('/') ? path : `/${path}`}`;
}
