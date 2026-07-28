import { z } from 'zod';

export const PayoutFiltersSchema = z.object({
  status: z
    .enum([
      'PENDING',
      'REQUIRES_CONFIRMATION',
      'PROCESSING',
      'COMPLETED',
      'FAILED',
      'CANCELLED',
    ])
    .optional(),
  destinationType: z
    .enum(['BANK_ACCOUNT', 'MOBILE_MONEY', 'CRYPTO_WALLET', 'STELLAR'])
    .optional(),
  currency: z.string().min(3).max(12).toUpperCase().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  batchId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type PayoutFiltersDto = z.infer<typeof PayoutFiltersSchema>;
