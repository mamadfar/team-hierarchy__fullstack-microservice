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
    expect((failure as AppError).message).toMatch(/CONFLUENCE_PAGE_IDS|page not found \(404\)/i);
    expect(calls()).toBe(1);
  });

  it('maps 401/403 to actionable Confluence env guidance (no secrets)', async () => {
    const auth = await new HttpClient({
      adapter: scriptedAdapter([401]).adapter,
      baseDelayMs: 1,
    })
      .get('/pages/1')
      .catch((e: unknown) => e);
    expect(auth).toBeInstanceOf(AppError);
    expect((auth as AppError).status).toBe(502);
    expect((auth as AppError).message).toMatch(/CONFLUENCE_EMAIL|CONFLUENCE_API_TOKEN/i);
    expect((auth as AppError).message).not.toMatch(/Bearer |password=/i);

    const forbidden = await new HttpClient({
      adapter: scriptedAdapter([403]).adapter,
      baseDelayMs: 1,
    })
      .get('/pages/1')
      .catch((e: unknown) => e);
    expect((forbidden as AppError).message).toMatch(/CONFLUENCE_BASE_URL|View permission/i);
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
