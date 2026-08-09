import { Type } from 'class-transformer';
import {
  IsOptional,
  IsISO8601,
  IsString,
  IsNumber,
  IsIn,
} from 'class-validator';

const PAYMENT_STATUSES = [
  'PENDING',
  'AWAITING_CONFIRMATION',
  'QUOTE_LOCKED',
  'SOURCE_LOCKED',
  'STELLAR_LOCKED',
  'PROCESSING',
  'COMPLETED',
  'REFUNDING',
  'REFUNDED',
  'EXPIRED',
  'FAILED',
] as const;

/**
 * Query-string filters, so every value arrives as a string.
 *
 * The numeric fields carry `@Type(() => Number)` because of that: once a global
 * ValidationPipe was installed, `?limit=2` reached `@IsNumber()` as `"2"` and
 * was rejected with "limit must be a number conforming to the specified
 * constraints". Before the pipe existed nothing validated, so the string sailed
 * through — which is why this only broke when validation started working.
 *
 * Converted here rather than by turning on `enableImplicitConversion` globally:
 * that would coerce body DTOs too, and an amount field that quietly accepts
 * `"5"` for `5` is not what you want on the endpoints that move money.
 */
export class PaymentFiltersDto {
  @IsIn(PAYMENT_STATUSES)
  @IsOptional()
  status?: (typeof PAYMENT_STATUSES)[number];

  @IsISO8601()
  @IsOptional()
  from?: string; // ISO date

  @IsISO8601()
  @IsOptional()
  to?: string; // ISO date

  @IsString()
  @IsOptional()
  currency?: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  minAmount?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  maxAmount?: number;

  @IsString()
  @IsOptional()
  search?: string; // search by ID, customer email

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  page?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  limit?: number;

  @IsString()
  @IsOptional()
  @IsIn(['createdAt', 'amount', 'status'])
  sortBy?: 'createdAt' | 'amount' | 'status' = 'createdAt';

  @IsString()
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
