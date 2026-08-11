import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSyncAction } from '@/hooks/use-registry';
import { SyncError } from '@/lib/api';
import { useAppStore } from '@/store/app-store';
import en from '../../messages/en.json';

const postSync = vi.fn();
const isAbortError = vi.fn((error: unknown) => {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  if (error instanceof Error && error.name === 'AbortError') return true;
  return false;
});

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    postSync: (...args: unknown[]) => postSync(...args),
    isAbortError: (error: unknown) => isAbortError(error),
  };
});

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={en}>
        {children}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

const initial = useAppStore.getInitialState();

beforeEach(() => {
  useAppStore.setState(initial, true);
  postSync.mockReset();
  isAbortError.mockReset();
  isAbortError.mockImplementation((error: unknown) => {
    if (error instanceof DOMException && error.name === 'AbortError') return true;
    if (error instanceof Error && error.name === 'AbortError') return true;
    return false;
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useSyncAction', () => {
  it('aborts the prior in-flight sync when a new refresh starts', async () => {
    let resolveFirst!: () => void;
    const first = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });
    const signals: AbortSignal[] = [];
    postSync.mockImplementation((signal?: AbortSignal) => {
      if (signal) signals.push(signal);
      if (signals.length === 1) return first;
      return Promise.resolve();
    });

    const { result } = renderHook(() => useSyncAction(), { wrapper });

    let firstRun!: Promise<void>;
    act(() => {
      firstRun = result.current();
    });
    expect(signals).toHaveLength(1);
    expect(signals[0]!.aborted).toBe(false);

    await act(async () => {
      await result.current();
    });
    expect(signals).toHaveLength(2);
    expect(signals[0]!.aborted).toBe(true);

    resolveFirst();
    await act(async () => {
      await firstRun;
    });
    // Aborted first run must not leave syncing stuck or toast syncFailed.
    expect(useAppStore.getState().syncing).toBe(false);
    expect(useAppStore.getState().toast).toBe(en.syncedJust);
  });

  it('toasts rate-limit and skips fetch while cooling down', async () => {
    postSync.mockResolvedValue(undefined);
    const { result } = renderHook(() => useSyncAction(), { wrapper });

    await act(async () => {
      await result.current();
    });
    expect(postSync).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().syncCooldownUntil).toBeGreaterThan(Date.now());

    await act(async () => {
      await result.current();
    });
    expect(postSync).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().toast).toBe(en.syncRateLimited);
  });

  it('treats AbortError as non-failure (no syncFailed toast)', async () => {
    postSync.mockRejectedValue(new DOMException('Aborted', 'AbortError'));
    isAbortError.mockReturnValue(true);
    const { result } = renderHook(() => useSyncAction(), { wrapper });

    await act(async () => {
      await result.current();
    });
    expect(useAppStore.getState().toast).toBe('');
    expect(useAppStore.getState().syncError).toBeNull();
    expect(useAppStore.getState().syncing).toBe(false);
  });

  it('shows syncRateLimited toast on HTTP 429', async () => {
    postSync.mockRejectedValue(new SyncError(429, 'ThrottlerException'));
    const { result } = renderHook(() => useSyncAction(), { wrapper });

    await act(async () => {
      await result.current();
    });
    expect(useAppStore.getState().toast).toBe(en.syncRateLimited);
    expect(useAppStore.getState().syncError).toBeNull();
  });

  it('opens structure guide kind on 422 parse failures', async () => {
    postSync.mockRejectedValue(
      new SyncError(422, 'teams table (with "Team Name" and "Queue Key" columns) not found'),
    );
    const { result } = renderHook(() => useSyncAction(), { wrapper });

    await act(async () => {
      await result.current();
    });
    const s = useAppStore.getState();
    expect(s.syncErrorKind).toBe('structure');
    expect(s.setupGuideOpen).toBe(true);
    expect(s.syncError).toMatch(/teams table/i);
  });

  it('opens config guide kind on Confluence auth failures', async () => {
    postSync.mockRejectedValue(
      new SyncError(
        502,
        'Confluence authentication failed (401). Set CONFLUENCE_EMAIL and CONFLUENCE_API_TOKEN in .env',
      ),
    );
    const { result } = renderHook(() => useSyncAction(), { wrapper });

    await act(async () => {
      await result.current();
    });
    const s = useAppStore.getState();
    expect(s.syncErrorKind).toBe('config');
    expect(s.setupGuideOpen).toBe(true);
  });
});
