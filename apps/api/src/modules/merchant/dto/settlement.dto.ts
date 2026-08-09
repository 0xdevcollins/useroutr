import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

const SUPPORTED_ASSETS = ['USDC', 'USDT', 'XLM', 'ETH', 'DAI'];
const SUPPORTED_CHAINS = [
  'stellar',
  'ethereum',
  'base',
  'bnb',
  'polygon',
  'arbitrum',
  'avalanche',
  'solana',
  'starknet',
];

export class SettlementDto {
  @IsOptional()
  @IsString()
  @IsIn(SUPPORTED_ASSETS)
  settlementAsset?: string;

  @IsOptional()
  @IsString()
  settlementAddress?: string;

  @IsOptional()
  @IsString()
  @IsIn(SUPPORTED_CHAINS)
  settlementChain?: string;

  /**
   * Hold completed payments for a window before the balance becomes
   * spendable. Off by default: it delays the merchant's own access to their
   * money, so it is theirs to choose.
   */
  @IsOptional()
  @IsBoolean()
  settlementHoldEnabled?: boolean;

  /**
   * Length of that window. Bounded rather than free-form: under an hour is
   * too short for a payer to notice a problem and dispute, and over 30 days
   * is long enough that a merchant will believe their money is lost. The
   * contract's arbitration deadline adds up to 14 more days on top of this
   * if a dispute is opened, which is worth knowing before picking a number.
   */
  @IsOptional()
  @IsInt()
  @Min(3600)
  @Max(2_592_000)
  settlementHoldSeconds?: number;
}
