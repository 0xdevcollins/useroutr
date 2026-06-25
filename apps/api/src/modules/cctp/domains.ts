/**
 * CCTP V2 chain domain registry.
 *
 * Circle assigns each supported chain a numeric **domain ID**. The domain
 * is what we embed in burn calls (`destinationDomain`) so the destination
 * chain knows it's the intended recipient. Source of truth:
 * https://developers.circle.com/cctp/concepts/supported-chains-and-domains
 *
 * Versioning note: every entry here is **CCTP V2**. Aptos (4), Noble (9),
 * and Sui (8) are explicitly excluded — they're V1-only and our migration
 * plan is V2-only.
 *
 * Add a new chain by appending an entry. Nothing else in the codebase
 * hard-codes domain IDs.
 */

export type ChainKind =
  | 'evm' // Anything that talks RPC + signs with secp256k1 (Ethereum etc.)
  | 'stellar' // Soroban via Stellar SDK
  | 'solana'; // Anchor-style instructions via @solana/kit

export interface DomainEntry {
  /** Stable internal name we use in our DB and APIs (lowercase, no spaces). */
  id: string;
  /** Human display name (for logs, error messages, UIs). */
  label: string;
  /** Circle's CCTP V2 domain ID. */
  domain: number;
  /** How the SDK talks to this chain — picks the right client. */
  kind: ChainKind;
  /**
   * Whether the chain is currently enabled for routing in Tavvio. Set to
   * false for chains we support transit-wise but don't actively quote
   * yet. Lets us add chains to the registry ahead of go-live.
   */
  enabled: boolean;
}

/**
 * Full mainnet domain table. Lifted from Circle's docs as of May 2026.
 * When Circle adds a new chain we add a line here; when they retire one,
 * flip `enabled` to false rather than delete (callers may have cached
 * the id).
 */
export const DOMAINS: readonly DomainEntry[] = [
  { id: 'ethereum', label: 'Ethereum', domain: 0, kind: 'evm', enabled: true },
  {
    id: 'avalanche',
    label: 'Avalanche',
    domain: 1,
    kind: 'evm',
    enabled: true,
  },
  {
    id: 'optimism',
    label: 'OP Mainnet',
    domain: 2,
    kind: 'evm',
    enabled: true,
  },
  { id: 'arbitrum', label: 'Arbitrum', domain: 3, kind: 'evm', enabled: true },
  { id: 'solana', label: 'Solana', domain: 5, kind: 'solana', enabled: false },
  { id: 'base', label: 'Base', domain: 6, kind: 'evm', enabled: true },
  {
    id: 'polygon',
    label: 'Polygon PoS',
    domain: 7,
    kind: 'evm',
    enabled: true,
  },
  {
    id: 'unichain',
    label: 'Unichain',
    domain: 10,
    kind: 'evm',
    enabled: false,
  },
  { id: 'linea', label: 'Linea', domain: 11, kind: 'evm', enabled: false },
  { id: 'codex', label: 'Codex', domain: 12, kind: 'evm', enabled: false },
  { id: 'sonic', label: 'Sonic', domain: 13, kind: 'evm', enabled: false },
  {
    id: 'worldchain',
    label: 'World Chain',
    domain: 14,
    kind: 'evm',
    enabled: false,
  },
  { id: 'monad', label: 'Monad', domain: 15, kind: 'evm', enabled: false },
  { id: 'sei', label: 'Sei', domain: 16, kind: 'evm', enabled: false },
  {
    id: 'bnb',
    label: 'BNB Smart Chain',
    domain: 17,
    kind: 'evm',
    enabled: true,
  },
  { id: 'xdc', label: 'XDC', domain: 18, kind: 'evm', enabled: false },
  {
    id: 'hyperevm',
    label: 'HyperEVM',
    domain: 19,
    kind: 'evm',
    enabled: false,
  },
  { id: 'ink', label: 'Ink', domain: 21, kind: 'evm', enabled: false },
  { id: 'plume', label: 'Plume', domain: 22, kind: 'evm', enabled: false },
  {
    id: 'starknet',
    label: 'Starknet',
    domain: 25,
    kind: 'evm',
    enabled: false,
  },
  { id: 'arc', label: 'Arc', domain: 26, kind: 'evm', enabled: false },
  {
    id: 'stellar',
    label: 'Stellar',
    domain: 27,
    kind: 'stellar',
    enabled: true,
  },
  { id: 'edge', label: 'EDGE', domain: 28, kind: 'evm', enabled: false },
  {
    id: 'injective',
    label: 'Injective',
    domain: 29,
    kind: 'evm',
    enabled: false,
  },
  { id: 'morph', label: 'Morph', domain: 30, kind: 'evm', enabled: false },
  { id: 'pharos', label: 'Pharos', domain: 31, kind: 'evm', enabled: false },
] as const;

/** Map for O(1) lookups by string id. */
const BY_ID = new Map<string, DomainEntry>(DOMAINS.map((d) => [d.id, d]));

/** Map for O(1) reverse lookups by Circle domain number. */
const BY_DOMAIN = new Map<number, DomainEntry>(
  DOMAINS.map((d) => [d.domain, d]),
);

export function getDomain(id: string): DomainEntry | undefined {
  return BY_ID.get(id);
}

export function getDomainByNumber(domain: number): DomainEntry | undefined {
  return BY_DOMAIN.get(domain);
}

export function isEnabled(id: string): boolean {
  return BY_ID.get(id)?.enabled ?? false;
}

/** All chains we currently route between. Used by the quote engine. */
export function enabledDomains(): DomainEntry[] {
  return DOMAINS.filter((d) => d.enabled);
}
