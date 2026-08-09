import { z } from 'zod';

export const WithdrawSchema = z.object({
  /** Stellar public key. Validated again server-side against StrKey. */
  destinationAddress: z.string().min(56).max(56),
  /**
   * Decimal string, or the literal "all" to drain the USDC balance. A string
   * rather than a number so a large amount cannot lose precision on the way in.
   */
  amount: z.union([z.literal('all'), z.string().regex(/^\d+(\.\d{1,7})?$/)]),
  /** Only USDC in v1; present so the shape does not change when that grows. */
  asset: z.literal('USDC').default('USDC'),
});

export type WithdrawDto = z.infer<typeof WithdrawSchema>;
