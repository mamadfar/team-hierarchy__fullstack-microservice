'use client';

import { useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { buildIndex } from '@/lib/registry';
import { searchTeams } from '@/lib/search';
import { useRegistry, useSyncAction } from '@/hooks/use-registry';
import { useAppStore } from '@/store/app-store';
import { Sidebar, SEARCH_INPUT_ID } from '@/components/sidebar/sidebar';
import { Topbar } from '@/components/topbar/topbar';
import { FlowCanvas } from '@/components/canvas/flow-canvas';
import { DetailPanel } from '@/components/detail-panel';
import { ChatFab, ChatPanel } from '@/components/chat/chat';
import { LoadingOverlay } from '@/components/loading-overlay';
import { Toast } from '@/components/toast';
import { ConfluenceSetupGuide } from '@/components/confluence-setup-guide';

function isTypingTarget(el: Element | null): boolean {
  return !!el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
}

export function AppShell() {
  const { data: snapshot, isError, isPending, refetch } = useRegistry();
  const index = useMemo(() => (snapshot ? buildIndex(snapshot) : null), [snapshot]);
  const t = useTranslations();

  const q = useAppStore((s) => s.q);
  const hydrateSidebar = useAppStore((s) => s.hydrateSidebar);
  const syncError = useAppStore((s) => s.syncError);
  const syncErrorKind = useAppStore((s) => s.syncErrorKind);
  const setupGuideOpen = useAppStore((s) => s.setupGuideOpen);
  const onRefresh = useSyncAction();

  const results = useMemo(() => {
    if (!snapshot || !index || !q.trim()) return null;
    return searchTeams(snapshot.teams, index, q);
  }, [snapshot, index, q]);

  const matchKeys = useMemo(() => results?.map((t) => t.queueKey) ?? null, [results]);
  const registryEmpty = !!snapshot && snapshot.teams.length === 0;
  const showBlockingGuide = registryEmpty;
  const showDismissibleGuide = !registryEmpty && setupGuideOpen && !!syncError;
  const guideKind = syncErrorKind ?? 'structure';
  const hasTeams = !!snapshot && snapshot.teams.length > 0;

  // Restore persisted sidebar collapse state.
  useEffect(() => {
    hydrateSidebar();
  }, [hydrateSidebar]);

  // Keyboard: "/" focuses search (expanding the sidebar first), Escape closes panels.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(document.activeElement)) return;
      const state = useAppStore.getState();
      if (e.key === '/') {
        e.preventDefault();
        const wasCollapsed = state.collapsed;
        if (wasCollapsed) state.setCollapsed(false);
        setTimeout(
          () => document.getElementById(SEARCH_INPUT_ID)?.focus(),
          wasCollapsed ? 260 : 0,
        );
      }
      if (e.key === 'Escape') {
        state.clearSelection();
        state.closeChat();
        if (state.setupGuideOpen && !registryEmpty) state.closeSetupGuide();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [registryEmpty]);

  return (
    <div className="flex h-screen bg-bg text-text overflow-hidden text-[13px]">
      <Sidebar snapshot={snapshot ?? null} index={index} results={results} onRefresh={() => void onRefresh()} />
      <main className="relative flex-1 flex flex-col min-w-0">
        <Topbar />
        <div className="flex-1 min-h-0 relative">
          {hasTeams && snapshot && index && (
            <FlowCanvas snapshot={snapshot} index={index} matchKeys={matchKeys} />
          )}
          {showBlockingGuide && (
            <ConfluenceSetupGuide reason="empty" detail={syncError} kind={guideKind} blocking />
          )}
          {showDismissibleGuide && (
            <ConfluenceSetupGuide reason="sync" detail={syncError} kind={guideKind} />
          )}
        </div>

        {isPending && !snapshot && <LoadingOverlay />}
        {isError && !snapshot && (
          <div className="absolute top-[53px] left-0 right-0 bottom-0 z-[15] bg-bg flex flex-col items-center justify-center gap-[14px] px-6 text-center">
            <div className="font-sora font-semibold text-[13.5px]">{t('loadFailed')}</div>
            <button
              type="button"
              className="text-[12px] px-3 py-1.5 rounded-md bg-accent text-white font-medium"
              onClick={() => void refetch()}
            >
              {t('retry')}
            </button>
          </div>
        )}
        {hasTeams && snapshot && index && <DetailPanel snapshot={snapshot} index={index} />}
        {hasTeams && index && snapshot && <ChatPanel index={index} snapshot={snapshot} />}
        {hasTeams && <ChatFab />}
        <Toast />
      </main>
    </div>
  );
}
