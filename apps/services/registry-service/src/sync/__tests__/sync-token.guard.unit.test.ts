import { describe, expect, it } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';

import { AppError } from '../../common/app-error';
import { parseEnv } from '../../config/env';
import { SyncTokenGuard } from '../sync-token.guard';

function contextWithAuth(authorization?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: authorization ? { authorization } : {} }),
    }),
  } as unknown as ExecutionContext;
}

const guard = new SyncTokenGuard(parseEnv({ SYNC_APP_TOKEN: 'secret-token' }));

describe('SyncTokenGuard', () => {
  it('accepts the correct bearer token (scheme case-insensitive)', () => {
    expect(guard.canActivate(contextWithAuth('Bearer secret-token'))).toBe(true);
    expect(guard.canActivate(contextWithAuth('bearer secret-token'))).toBe(true);
  });

  it.each([
    ['missing header', undefined],
    ['empty bearer', 'Bearer '],
    ['wrong token', 'Bearer nope'],
    ['different length token', 'Bearer secret-token-but-longer'],
    ['non-bearer scheme', 'Basic secret-token'],
  ])('rejects %s with a 401 AppError', (_label, header) => {
    try {
      guard.canActivate(contextWithAuth(header));
      expect.unreachable('guard must throw');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).status).toBe(401);
    }
  });
});
