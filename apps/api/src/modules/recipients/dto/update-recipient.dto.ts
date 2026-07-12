import { z } from 'zod';
import { CreateRecipientSchema } from './create-recipient.dto';

export const UpdateRecipientSchema = CreateRecipientSchema.partial();

export type UpdateRecipientDto = z.infer<typeof UpdateRecipientSchema>;
