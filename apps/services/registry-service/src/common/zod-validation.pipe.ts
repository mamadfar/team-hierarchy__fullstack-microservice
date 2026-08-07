import { Injectable, PipeTransform } from '@nestjs/common';
import { ZodType } from 'zod';

import { AppError } from './app-error';
import { formatZodError } from './zod-error';

/** Validates any external input (params, query, body) with a zod schema; 400 on failure. */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new AppError(400, `Validation failed: ${formatZodError(result.error)}`);
    }
    return result.data;
  }
}
