import { create } from 'zustand';

export type TabId = 'explorer' | 'hierarchy';

export interface ChatMsg {
  role: 'user' | 'assistant';
  text: string;
  /** Queue keys of recommended teams (assistant messages only). */
  keys?: string[];
}

const SIDE_STORAGE_KEY = 'orbit-side';

export interface AppState {
  selectedKey: string;
  tab: TabId;
  q: string;
  chatOpen: boolean;
  msgs: ChatMsg[];
  busy: boolean;
  syncing: boolean;
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
  showToast: (msg: string) => void;
  /** Chat team chip: close chat, switch to Explorer, select + zoom. */
  pickFromChat: (key: string) => void;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useAppStore = create<AppState>()((set, get) => ({
  selectedKey: '',
  tab: 'explorer',
  q: '',
  chatOpen: false,
  msgs: [],
  busy: false,
  syncing: false,
  expandedDomains: { pay: true },
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
  clearSelection: () => set({ selectedKey: '' }),
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
  showToast: (msg) => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: msg });
    toastTimer = setTimeout(() => set({ toast: '' }), 2200);
  },
  pickFromChat: (key) => {
    set({ chatOpen: false });
    get().select(key, { toExplorer: true });
  },
}));
