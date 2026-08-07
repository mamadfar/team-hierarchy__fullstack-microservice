'use client';

import { useEffect, useMemo } from 'react';
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

function isTypingTarget(el: Element | null): boolean {
  return !!el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
}

export function AppShell() {
  const { data: snapshot } = useRegistry();
  const index = useMemo(() => (snapshot ? buildIndex(snapshot) : null), [snapshot]);

  const q = useAppStore((s) => s.q);
  const hydrateSidebar = useAppStore((s) => s.hydrateSidebar);
  const onRefresh = useSyncAction();

  const results = useMemo(() => {
    if (!snapshot || !index || !q.trim()) return null;
    return searchTeams(snapshot.teams, index, q);
  }, [snapshot, index, q]);

  const matchKeys = useMemo(() => results?.map((t) => t.queueKey) ?? null, [results]);

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
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex h-screen bg-bg text-text overflow-hidden text-[13px]">
      <Sidebar snapshot={snapshot ?? null} index={index} results={results} onRefresh={() => void onRefresh()} />
      <main className="relative flex-1 flex flex-col min-w-0">
        <Topbar />
        <div className="flex-1 min-h-0">
          {snapshot && index && (
            <FlowCanvas snapshot={snapshot} index={index} matchKeys={matchKeys} />
          )}
        </div>

        {!snapshot && <LoadingOverlay />}
        {snapshot && index && <DetailPanel snapshot={snapshot} index={index} />}
        {index && <ChatPanel index={index} />}
        <ChatFab />
        <Toast />
      </main>
    </div>
  );
}
