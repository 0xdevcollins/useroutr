import { PipeTransform, BadRequestException } from '@nestjs/common';
import type { z } from 'zod';

interface ValidationError {
  field: string;
  message: string;
}

export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private schema: z.ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      const errors: ValidationError[] = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));

      throw new BadRequestException({
        message: 'Validation failed',
        errors,
      });
    }

    return result.data;
  }
}
