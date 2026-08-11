import { create } from 'zustand';
import type { SyncErrorKind } from '@/lib/sync-error';

export type TabId = 'explorer' | 'hierarchy';
export type { SyncErrorKind };

export interface ChatMsg {
  role: 'user' | 'assistant';
  text: string;
  /** Queue keys of recommended teams (assistant messages only). */
  keys?: string[];
}

const SIDE_STORAGE_KEY = 'orbit-side';

export interface AppState {
  selectedKey: string;
  /** Queue keys recommended by the latest assistant answer (multi-highlight). */
  aiKeys: string[];
  tab: TabId;
  q: string;
  chatOpen: boolean;
  msgs: ChatMsg[];
  busy: boolean;
  syncing: boolean;
  /** Epoch ms until Refresh is allowed again (0 = ready). */
  syncCooldownUntil: number;
  /** Last sync failure message from registry; null when ok. */
  syncError: string | null;
  /** How to present the last sync failure (structure vs env/auth). */
  syncErrorKind: SyncErrorKind | null;
  /** When true, show the Confluence setup guide (empty registry or sync error). */
  setupGuideOpen: boolean;
  expandedDomains: Record<string, boolean>;
  toast: string;
  collapsed: boolean;
  focusKey: string;
  focusNonce: number;

  /**
   * The single selection action every entry point converges on
   * (search result, sidebar row, chat chip, canvas card, related team):
   * selects the team and bumps focusNonce so the canvas zooms to it.
   * Chat picks pass toExplorer to also switch back to the Explorer tab.
   */
  select: (key: string, opts?: { toExplorer?: boolean }) => void;
  clearSelection: () => void;
  setTab: (tab: TabId) => void;
  setQ: (q: string) => void;
  toggleDomain: (slug: string) => void;
  setCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  hydrateSidebar: () => void;
  toggleChat: () => void;
  closeChat: () => void;
  pushMsg: (msg: ChatMsg) => void;
  setBusy: (busy: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  /** Starts a client cooldown; clears automatically when `ms` elapses. */
  startSyncCooldown: (ms: number) => void;
  setSyncError: (message: string | null, kind?: SyncErrorKind | null) => void;
  openSetupGuide: () => void;
  closeSetupGuide: () => void;
  showToast: (msg: string) => void;
  /** Chat team chip: close chat, switch to Explorer, select + zoom. */
  pickFromChat: (key: string) => void;
  /**
   * Apply assistant-recommended queue keys: multi-highlight on Explorer,
   * switch to Explorer, select + zoom the primary (first) team.
   * Empty keys clear the AI highlight only.
   */
  applyChatTeams: (keys: string[]) => void;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
let syncCooldownTimer: ReturnType<typeof setTimeout> | undefined;

export const useAppStore = create<AppState>()((set, get) => ({
  selectedKey: '',
  aiKeys: [],
  tab: 'explorer',
  q: '',
  chatOpen: false,
  msgs: [],
  busy: false,
  syncing: false,
  syncCooldownUntil: 0,
  syncError: null,
  syncErrorKind: null,
  setupGuideOpen: false,
  expandedDomains: {},
  toast: '',
  collapsed: false,
  focusKey: '',
  focusNonce: 0,

  select: (key, opts) =>
    set((s) => ({
      selectedKey: key,
      focusKey: key,
      focusNonce: s.focusNonce + 1,
      tab: opts?.toExplorer ? 'explorer' : s.tab,
    })),
  clearSelection: () => set({ selectedKey: '', aiKeys: [] }),
  setTab: (tab) => set({ tab }),
  setQ: (q) => set({ q }),
  toggleDomain: (slug) =>
    set((s) => ({ expandedDomains: { ...s.expandedDomains, [slug]: !s.expandedDomains[slug] } })),
  setCollapsed: (collapsed) => {
    try {
      localStorage.setItem(SIDE_STORAGE_KEY, collapsed ? '1' : '0');
    } catch {
      /* storage unavailable */
    }
    set({ collapsed });
  },
  toggleSidebar: () => get().setCollapsed(!get().collapsed),
  hydrateSidebar: () => {
    try {
      if (localStorage.getItem(SIDE_STORAGE_KEY) === '1') set({ collapsed: true });
    } catch {
      /* storage unavailable */
    }
  },
  toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen })),
  closeChat: () => set({ chatOpen: false }),
  pushMsg: (msg) => set((s) => ({ msgs: [...s.msgs, msg] })),
  setBusy: (busy) => set({ busy }),
  setSyncing: (syncing) => set({ syncing }),
  startSyncCooldown: (ms) => {
    if (syncCooldownTimer) clearTimeout(syncCooldownTimer);
    const until = Date.now() + ms;
    set({ syncCooldownUntil: until });
    syncCooldownTimer = setTimeout(() => set({ syncCooldownUntil: 0 }), ms);
  },
  setSyncError: (message, kind) =>
    set({
      syncError: message,
      syncErrorKind: message == null ? null : (kind ?? 'structure'),
      setupGuideOpen: message != null,
    }),
  openSetupGuide: () => set({ setupGuideOpen: true }),
  closeSetupGuide: () => set({ setupGuideOpen: false }),
  showToast: (msg) => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: msg });
    toastTimer = setTimeout(() => set({ toast: '' }), 2200);
  },
  pickFromChat: (key) => {
    set({ chatOpen: false });
    get().select(key, { toExplorer: true });
  },
  applyChatTeams: (keys) => {
    const unique = [...new Set(keys.filter(Boolean))];
    set({ aiKeys: unique });
    const primary = unique[0];
    if (primary) get().select(primary, { toExplorer: true });
  },
}));
