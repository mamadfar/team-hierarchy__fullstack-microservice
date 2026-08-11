import { afterEach, describe, expect, it, vi } from 'vitest';
import { isAbortError, postSync, SyncError, SYNC_COOLDOWN_MS } from '@/lib/api';

describe('postSync', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves on 2xx', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) }),
    );
    await expect(postSync()).resolves.toBeUndefined();
  });

  it('passes AbortSignal to fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    const ac = new AbortController();
    await postSync(ac.signal);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/sync',
      expect.objectContaining({ method: 'POST', signal: ac.signal }),
    );
  });

  it('rejects with AbortError when the signal is already aborted', async () => {
    const ac = new AbortController();
    ac.abort();
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        if (init?.signal?.aborted) {
          return Promise.reject(new DOMException('Aborted', 'AbortError'));
        }
        return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
      }),
    );
    await expect(postSync(ac.signal)).rejects.toSatisfy(isAbortError);
  });

  it('throws SyncError with registry message on 422', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({
          status: 422,
          message: 'teams table (with "Team Name" and "Queue Key" columns) not found',
        }),
      }),
    );
    await expect(postSync()).rejects.toMatchObject({
      name: 'SyncError',
      status: 422,
      message: 'teams table (with "Team Name" and "Queue Key" columns) not found',
    });
    expect(SyncError.name).toBe('SyncError');
  });
});

describe('isAbortError / SYNC_COOLDOWN_MS', () => {
  it('detects DOMException and Error AbortError', () => {
    expect(isAbortError(new DOMException('Aborted', 'AbortError'))).toBe(true);
    const err = new Error('aborted');
    err.name = 'AbortError';
    expect(isAbortError(err)).toBe(true);
    expect(isAbortError(new SyncError(500, 'nope'))).toBe(false);
  });

  it('cooldown is 20s (registry 3/min)', () => {
    expect(SYNC_COOLDOWN_MS).toBe(20_000);
  });
});
