import { createHash, timingSafeEqual } from 'node:crypto';

import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';

import { AppError } from '../common/app-error';
import { ENV, Env } from '../config/env';

/**
 * POST /sync requires `Authorization: Bearer <SYNC_APP_TOKEN>`.
 * Comparison is constant-time over sha256 digests, so neither content nor
 * length of the expected token leaks through timing.
 */
@Injectable()
export class SyncTokenGuard implements CanActivate {
  constructor(@Inject(ENV) private readonly env: Env) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, unknown> }>();
    const header = request.headers['authorization'];
    const provided =
      typeof header === 'string' && header.toLowerCase().startsWith('bearer ')
        ? header.slice(7).trim()
        : '';

    if (!provided || !this.matches(provided, this.env.SYNC_APP_TOKEN)) {
      throw new AppError(401, 'Missing or invalid sync token');
    }
    return true;
  }

  private matches(provided: string, expected: string): boolean {
    const a = createHash('sha256').update(provided).digest();
    const b = createHash('sha256').update(expected).digest();
    return timingSafeEqual(a, b);
  }
}
