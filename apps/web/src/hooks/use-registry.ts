'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import {
  fetchRegistry,
  isAbortError,
  postSync,
  SYNC_COOLDOWN_MS,
  SyncError,
} from '@/lib/api';
import { categorizeSyncError } from '@/lib/sync-error';
import { useAppStore } from '@/store/app-store';

export const REGISTRY_QUERY_KEY = ['registry'] as const;

/** Module-level: abort prior Refresh if a new one starts. */
let syncAbort: AbortController | null = null;

/** Registry snapshot — fetched ONCE on load; afterwards only via the Refresh button. */
export function useRegistry() {
  return useQuery({
    queryKey: REGISTRY_QUERY_KEY,
    queryFn: fetchRegistry,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 2,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

/**
 * Refresh button action: POST the app's own /api/sync proxy (server injects
 * the SYNC_APP_TOKEN), then refetch the registry and toast "Synced just now".
 * Structure/parse failures open the Confluence setup guide with the registry message.
 * Aborts any in-flight sync when a new one starts; client cooldown ≈ registry 3/min.
 */
export function useSyncAction() {
  const queryClient = useQueryClient();
  const t = useTranslations();
  return useCallback(async () => {
    const store = useAppStore.getState();
    // Cooldown only when idle — an in-flight Refresh may be superseded (abort prior).
    if (!store.syncing && store.syncCooldownUntil > Date.now()) {
      store.showToast(t('syncRateLimited'));
      return;
    }

    // Abort prior in-flight Refresh so Confluence calls don't stack.
    syncAbort?.abort();
    const ac = new AbortController();
    syncAbort = ac;

    store.setSyncing(true);
    store.startSyncCooldown(SYNC_COOLDOWN_MS);
    try {
      await postSync(ac.signal);
      if (ac.signal.aborted) return;
      useAppStore.getState().setSyncError(null);
      await queryClient.invalidateQueries({ queryKey: REGISTRY_QUERY_KEY });
      if (ac.signal.aborted) return;
      useAppStore.getState().showToast(t('syncedJust'));
    } catch (error) {
      if (isAbortError(error) || ac.signal.aborted) return;
      if (error instanceof SyncError && error.status === 429) {
        useAppStore.getState().showToast(t('syncRateLimited'));
        return;
      }
      const message = error instanceof Error && error.message ? error.message : t('syncFailed');
      const status = error instanceof SyncError ? error.status : null;
      const kind = categorizeSyncError(status, message);
      useAppStore.getState().setSyncError(message, kind);
      useAppStore.getState().showToast(t('syncFailed'));
    } finally {
      // Only the latest controller clears syncing (aborted predecessors stay quiet).
      if (syncAbort === ac) {
        syncAbort = null;
        useAppStore.getState().setSyncing(false);
      }
    }
  }, [queryClient, t]);
}
