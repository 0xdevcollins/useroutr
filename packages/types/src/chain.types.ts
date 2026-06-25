export type Chain =
  | 'stellar'
  | 'ethereum'
  | 'base'
  | 'bnb'
  | 'polygon'
  | 'arbitrum'
  | 'avalanche'
  | 'solana'
  | 'starknet';

export interface AddressDetectionResult {
  possibleChains: Chain[];
  format:         "evm" | "stellar" | "solana" | "starknet" | "unknown";
  requiresChainSelection: boolean;
}
