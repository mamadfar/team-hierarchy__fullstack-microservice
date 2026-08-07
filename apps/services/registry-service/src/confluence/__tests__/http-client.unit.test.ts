import { describe, expect, it } from 'vitest';
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';

import { AppError } from '../../common/app-error';
import { HttpClient } from '../http-client';

/** Adapter that plays a scripted sequence of statuses, then repeats the last. */
function scriptedAdapter(statuses: number[], body: unknown = { ok: true }) {
  let call = 0;
  const calls = () => call;
  const adapter: AxiosAdapter = (config: InternalAxiosRequestConfig) => {
    const status = statuses[Math.min(call, statuses.length - 1)] as number;
    call += 1;
    const response = {
      data: body,
      status,
      statusText: `S${status}`,
      headers: {},
      config,
    };
    if (status >= 200 && status < 300) return Promise.resolve(response);
    return Promise.reject(
      new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_RESPONSE', config, null, response),
    );
  };
  return { adapter, calls };
}

describe('HttpClient', () => {
  it('retries 429 with backoff and eventually succeeds', async () => {
    const { adapter, calls } = scriptedAdapter([429, 429, 200], { title: 'Page' });
    const client = new HttpClient({ adapter, baseDelayMs: 1, maxAttempts: 4 });

    const data = await client.get<{ title: string }>('/pages/1');
    expect(data.title).toBe('Page');
    expect(calls()).toBe(3);
  });

  it('retries 5xx and gives up after maxAttempts as an operational AppError', async () => {
    const { adapter, calls } = scriptedAdapter([503]);
    const client = new HttpClient({ adapter, baseDelayMs: 1, maxAttempts: 3 });

    const failure = await client.get('/pages/1').catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(AppError);
    expect((failure as AppError).status).toBe(502);
    expect(calls()).toBe(3);
  });

  it('does NOT retry non-retryable statuses like 404', async () => {
    const { adapter, calls } = scriptedAdapter([404]);
    const client = new HttpClient({ adapter, baseDelayMs: 1 });

    const failure = await client.get('/pages/missing').catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(AppError);
    expect((failure as AppError).message).toContain('404');
    expect(calls()).toBe(1);
  });

  it('maps timeouts to a 504 AppError', async () => {
    const adapter: AxiosAdapter = (config) =>
      Promise.reject(new AxiosError('timeout of 10ms exceeded', 'ECONNABORTED', config));
    const client = new HttpClient({ adapter, baseDelayMs: 1 });

    const failure = await client.get('/slow').catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(AppError);
    expect((failure as AppError).status).toBe(504);
  });
});
