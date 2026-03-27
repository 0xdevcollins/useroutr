import { z } from 'zod';

export const RegisterSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  companyName: z.string().max(255).optional(),
});

export type RegisterDto = z.infer<typeof RegisterSchema>;
