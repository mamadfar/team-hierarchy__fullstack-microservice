import { PipeTransform } from '@nestjs/common';
import type { z, ZodTypeAny } from 'zod';
import { AppError } from './app-error';

/**
 * Body validation via the shared zod schemas (single source of truth with the
 * frontend) instead of duplicating rules in class-validator decorators.
 * Generic over the schema so defaults/transforms (input != output) type-check.
 */
export class ZodValidationPipe<S extends ZodTypeAny>
  implements PipeTransform<unknown, z.output<S>>
{
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.output<S> {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      const details = parsed.error.issues
        .map((i) => `${i.path.join('.') || 'body'}: ${i.message}`)
        .join('; ');
      throw new AppError(400, `Invalid request: ${details}`);
    }
    return parsed.data;
  }
}
