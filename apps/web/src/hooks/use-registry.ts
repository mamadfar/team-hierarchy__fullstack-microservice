'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { fetchRegistry, postSync } from '@/lib/api';
import { useAppStore } from '@/store/app-store';

export const REGISTRY_QUERY_KEY = ['registry'] as const;

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
 */
export function useSyncAction() {
  const queryClient = useQueryClient();
  const t = useTranslations();
  return useCallback(async () => {
    const { syncing, setSyncing, showToast } = useAppStore.getState();
    if (syncing) return;
    setSyncing(true);
    try {
      await postSync();
      await queryClient.invalidateQueries({ queryKey: REGISTRY_QUERY_KEY });
      showToast(t('syncedJust'));
    } catch {
      // Sync failed: stop the spinner; the previous snapshot stays live.
    } finally {
      useAppStore.getState().setSyncing(false);
    }
  }, [queryClient, t]);
}
