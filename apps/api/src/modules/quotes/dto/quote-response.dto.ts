export class QuoteResponseDto {
  /**
   * Unique quote ID
   */
  id!: string;

  /**
   * Source chain
   */
  fromChain!: string;

  /**
   * Source asset symbol
   */
  fromAsset!: string;

  /**
   * Source amount (requested)
   */
  fromAmount!: string;

  /**
   * Destination chain
   */
  toChain!: string;

  /**
   * Destination asset symbol
   */
  toAsset!: string;

  /**
   * Net amount merchant receives (after fees)
   */
  toAmount!: string;

  /**
   * Exchange rate (destination / source)
   */
  rate!: string;

  /**
   * Fee amount in destination asset
   */
  fee!: string;

  /**
   * Fee in basis points (0-10000)
   */
  feeBps!: number;

  /**
   * Route provider: "cctp_v2" for cross-chain USDC, "stellar_native" for
   * Stellar↔Stellar path payments, or null for same-asset same-chain.
   */
  bridgeProvider!: string | null;

  /**
   * Estimated time for cross-chain settlement in milliseconds
   */
  estimatedTimeMs!: number;

  /**
   * When this quote expires (ISO 8601 timestamp)
   */
  expiresAt!: string;

  /**
   * Seconds until quote expires
   */
  expiresInSeconds!: number;
}
