import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, type ArgumentsHost } from '@nestjs/common';
import { z, ZodError } from 'zod';

import { parseEnv } from '../../config/env';
import { AllExceptionsFilter } from '../all-exceptions.filter';
import { AppError } from '../app-error';
import { formatZodError } from '../zod-error';
import { ZodValidationPipe } from '../zod-validation.pipe';

function makeHost() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('AllExceptionsFilter', () => {
  const prodFilter = new AllExceptionsFilter(parseEnv({ NODE_ENV: 'production' }));

  it('AppError -> its status + message, no stack outside development', () => {
    const { host, status, json } = makeHost();
    prodFilter.catch(new AppError(404, 'Unknown team'), host);
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ status: 404, message: 'Unknown team' });
  });

  it('HttpException array messages are joined', () => {
    const { host, json } = makeHost();
    prodFilter.catch(new BadRequestException(['a required', 'b invalid']), host);
    expect(json).toHaveBeenCalledWith({ status: 400, message: 'a required; b invalid' });
  });

  it('ZodError -> 400 with a formatted message', () => {
    const { host, json } = makeHost();
    const zodError = z.object({ hue: z.number() }).safeParse({ hue: 'x' });
    prodFilter.catch((zodError as { error: ZodError }).error, host);
    const body = json.mock.calls[0]?.[0] as { status: number; message: string };
    expect(body.status).toBe(400);
    expect(body.message).toContain('hue');
  });

  it('unknown errors -> sanitized 500; development attaches the stack', () => {
    const { host, json } = makeHost();
    prodFilter.catch(new Error('secret internals'), host);
    expect(json).toHaveBeenCalledWith({ status: 500, message: 'Internal server error' });

    const devFilter = new AllExceptionsFilter(parseEnv({ NODE_ENV: 'development' }));
    const dev = makeHost();
    devFilter.catch(new Error('boom'), dev.host);
    const body = dev.json.mock.calls[0]?.[0] as { stack?: string };
    expect(body.stack).toContain('boom');
  });
});

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(z.string().trim().min(1).max(5));

  it('passes and transforms valid values', () => {
    expect(pipe.transform('  ab ')).toBe('ab');
  });

  it('rejects invalid values with a 400-style error', () => {
    expect(() => pipe.transform('toolong')).toThrowError();
  });
});

describe('formatZodError', () => {
  it('renders path and message per issue', () => {
    const result = z.object({ a: z.object({ b: z.number() }) }).safeParse({ a: { b: 'x' } });
    if (result.success) throw new Error('expected failure');
    const text = formatZodError(result.error);
    expect(text).toContain('a.b');
  });
});
