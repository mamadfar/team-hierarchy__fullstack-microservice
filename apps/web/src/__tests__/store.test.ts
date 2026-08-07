import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '@/store/app-store';

const initial = useAppStore.getInitialState();

beforeEach(() => {
  useAppStore.setState(initial, true);
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('app store', () => {
  it('starts with the pay domain expanded and the Explorer tab', () => {
    const s = useAppStore.getState();
    expect(s.tab).toBe('explorer');
    expect(s.expandedDomains).toEqual({ pay: true });
    expect(s.selectedKey).toBe('');
    expect(s.focusNonce).toBe(0);
  });

  it('select() converges selection + focus: sets key and bumps focusNonce', () => {
    useAppStore.getState().select('PAY-CHK');
    let s = useAppStore.getState();
    expect(s.selectedKey).toBe('PAY-CHK');
    expect(s.focusKey).toBe('PAY-CHK');
    expect(s.focusNonce).toBe(1);
    expect(s.tab).toBe('explorer');

    // selecting again re-bumps the nonce so the canvas re-zooms
    useAppStore.getState().select('PAY-CHK');
    s = useAppStore.getState();
    expect(s.focusNonce).toBe(2);
  });

  it('select() keeps the current tab unless toExplorer is passed', () => {
    useAppStore.getState().setTab('hierarchy');
    useAppStore.getState().select('DATA-STR');
    expect(useAppStore.getState().tab).toBe('hierarchy');

    useAppStore.getState().select('DATA-STR', { toExplorer: true });
    expect(useAppStore.getState().tab).toBe('explorer');
  });

  it('pickFromChat closes the chat, switches to Explorer and selects + zooms', () => {
    useAppStore.setState({ chatOpen: true, tab: 'hierarchy' });
    useAppStore.getState().pickFromChat('DATA-STR');
    const s = useAppStore.getState();
    expect(s.chatOpen).toBe(false);
    expect(s.tab).toBe('explorer');
    expect(s.selectedKey).toBe('DATA-STR');
    expect(s.focusNonce).toBe(1);
  });

  it('clearSelection only clears the selected key (focus history stays)', () => {
    useAppStore.getState().select('PAY-CHK');
    useAppStore.getState().clearSelection();
    const s = useAppStore.getState();
    expect(s.selectedKey).toBe('');
    expect(s.focusNonce).toBe(1);
  });

  it('toggleDomain flips per-domain expansion', () => {
    useAppStore.getState().toggleDomain('pay');
    expect(useAppStore.getState().expandedDomains['pay']).toBe(false);
    useAppStore.getState().toggleDomain('risk');
    expect(useAppStore.getState().expandedDomains['risk']).toBe(true);
  });

  it('persists sidebar collapse and hydrates it back', () => {
    useAppStore.getState().setCollapsed(true);
    expect(localStorage.getItem('orbit-side')).toBe('1');

    useAppStore.setState(initial, true);
    expect(useAppStore.getState().collapsed).toBe(false);
    useAppStore.getState().hydrateSidebar();
    expect(useAppStore.getState().collapsed).toBe(true);
  });

  it('chat message flow: push user + assistant messages with team keys', () => {
    useAppStore.getState().pushMsg({ role: 'user', text: 'who owns kafka?' });
    useAppStore.getState().setBusy(true);
    useAppStore.getState().pushMsg({ role: 'assistant', text: 'Streaming owns it.', keys: ['DATA-STR'] });
    useAppStore.getState().setBusy(false);
    const s = useAppStore.getState();
    expect(s.msgs).toHaveLength(2);
    expect(s.msgs[1]?.keys).toEqual(['DATA-STR']);
    expect(s.busy).toBe(false);
  });

  it('showToast auto-dismisses after 2.2s', () => {
    vi.useFakeTimers();
    useAppStore.getState().showToast('Queue key copied');
    expect(useAppStore.getState().toast).toBe('Queue key copied');
    vi.advanceTimersByTime(2199);
    expect(useAppStore.getState().toast).toBe('Queue key copied');
    vi.advanceTimersByTime(2);
    expect(useAppStore.getState().toast).toBe('');
  });
});
