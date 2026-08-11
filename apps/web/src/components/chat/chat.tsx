'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { ChatMessage, Locale, RegistrySnapshot } from '@orbit/shared';
import { postChat } from '@/lib/api';
import { buildChatPlaceholderHint, buildChatStarters } from '@/lib/chat-starters';
import type { RegistryIndex } from '@/lib/registry';
import { isLocale } from '@/i18n/locales';
import { useAppStore } from '@/store/app-store';
import { OrbitLogo } from '@/components/logo';
import {
  IconChevronDown,
  IconClose,
  IconPin,
  IconSend,
  IconSparkle,
} from '@/components/chrome-icons';
import { Input } from '@/components/ui/input';

export function ChatFab() {
  const t = useTranslations();
  const chatOpen = useAppStore((s) => s.chatOpen);
  const toggleChat = useAppStore((s) => s.toggleChat);
  return (
    <button
      type="button"
      onClick={toggleChat}
      aria-label={t('chatTitle')}
      title={t('chatTitle')}
      className="orbit-fab absolute bottom-5 right-5 z-[31] h-[46px] px-4 rounded-full border-none bg-accent text-accent-fg cursor-pointer flex items-center gap-2 font-sora font-semibold text-[13px]"
      style={{ boxShadow: '0 8px 24px rgba(56,128,255,.30)' }}
    >
      {chatOpen ? (
        <IconChevronDown size={18} stroke="currentColor" strokeWidth={2.4} />
      ) : (
        <>
          <IconSparkle size={17} />
          <span>{t('askOrbit')}</span>
        </>
      )}
    </button>
  );
}

export function ChatPanel({
  index,
  snapshot,
}: {
  index: RegistryIndex;
  snapshot: RegistrySnapshot;
}) {
  const t = useTranslations();
  const rawLocale = useLocale();
  const lang: Locale = isLocale(rawLocale) ? rawLocale : 'en';

  const chatOpen = useAppStore((s) => s.chatOpen);
  const toggleChat = useAppStore((s) => s.toggleChat);
  const msgs = useAppStore((s) => s.msgs);
  const busy = useAppStore((s) => s.busy);
  const pushMsg = useAppStore((s) => s.pushMsg);
  const setBusy = useAppStore((s) => s.setBusy);
  const pickFromChat = useAppStore((s) => s.pickFromChat);
  const applyChatTeams = useAppStore((s) => s.applyChatTeams);

  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const starters = useMemo(
    () =>
      buildChatStarters(
        snapshot,
        {
          whoHandles: (v) => t('starterWhoHandles', v),
          aboutKeyword: (v) => t('starterAboutKeyword', v),
          aboutDomain: (v) => t('starterAboutDomain', v),
        },
        t.raw('startersFallback') as string[],
      ),
    // lang switches messages; snapshot refresh rebuilds chips after sync.
    [lang, snapshot, t],
  );
  const placeholderExample = useMemo(
    () => buildChatPlaceholderHint(snapshot, t('chatPlaceholderFallback')),
    [lang, snapshot, t],
  );

  const scrollToEnd = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);
  useEffect(() => {
    scrollToEnd();
  }, [msgs, busy, scrollToEnd]);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      const state = useAppStore.getState();
      if (!text || state.busy) return;
      const history = [...state.msgs, { role: 'user' as const, text }];
      pushMsg({ role: 'user', text });
      setInput('');
      applyChatTeams([]);
      setBusy(true);
      try {
        const payload: ChatMessage[] = history
          .slice(-8)
          .map((m) => ({ role: m.role, content: m.text }));
        const res = await postChat(payload, lang);
        const keys = res.teams
          .map((team) => team.queueKey)
          .filter((key) => index.teams.has(key));
        pushMsg({ role: 'assistant', text: res.answer, keys });
        applyChatTeams(keys);
      } catch {
        pushMsg({ role: 'assistant', text: t('chatError'), keys: [] });
        applyChatTeams([]);
      } finally {
        setBusy(false);
      }
    },
    [applyChatTeams, index, lang, pushMsg, setBusy, t],
  );

  if (!chatOpen) return null;

  const showStarters = msgs.length === 0 && !busy;

  return (
    <div
      className="absolute bottom-[84px] right-5 w-[372px] h-[520px] max-h-[calc(100%-150px)] bg-surface border border-border rounded-2xl z-30 flex flex-col overflow-hidden anim-ofup"
      style={{ boxShadow: '0 16px 50px rgba(10,10,30,.2)' }}
      role="dialog"
      aria-label={t('chatTitle')}
    >
      <div className="flex-none flex items-center gap-[10px] px-4 py-[13px] border-b border-border-soft">
        <OrbitLogo size={22} />
        <div className="flex-1">
          <div className="font-sora font-bold text-[13.5px]">{t('chatTitle')}</div>
        </div>
        <button
          type="button"
          onClick={toggleChat}
          aria-label={t('close')}
          title={t('close')}
          className="border-none bg-transparent cursor-pointer text-muted p-1 flex"
        >
          <IconClose size={14} />
        </button>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto pt-[14px] px-[14px] pb-[6px] flex flex-col gap-[10px]"
      >
        <div className="text-xs text-muted bg-surface2 rounded-[10px] px-3 py-[9px] leading-normal">
          {t('chatIntro')}
        </div>

        {showStarters && (
          <div className="flex flex-col gap-[6px] items-start">
            {starters.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void send(s)}
                className="chip-starter text-xs border border-border bg-transparent text-text rounded-full px-3 py-[6px] cursor-pointer text-left"
                style={{ transition: 'border-color .15s, color .15s' }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {msgs.map((m, i) => {
          const user = m.role === 'user';
          return (
            <div
              key={i}
              className="flex flex-col anim-ofup-fast"
              style={{ alignItems: user ? 'flex-end' : 'flex-start' }}
            >
              <div
                style={
                  user
                    ? {
                        background: 'var(--deep)',
                        color: '#fff',
                        borderRadius: '14px 14px 4px 14px',
                        padding: '8px 12px',
                        maxWidth: '85%',
                        fontSize: 12.5,
                        lineHeight: 1.5,
                        whiteSpace: 'pre-wrap',
                      }
                    : {
                        background: 'var(--surface2)',
                        border: '1px solid var(--border-soft)',
                        color: 'var(--text)',
                        borderRadius: '14px 14px 14px 4px',
                        padding: '8px 12px',
                        maxWidth: '90%',
                        fontSize: 12.5,
                        lineHeight: 1.5,
                        whiteSpace: 'pre-wrap',
                      }
                }
              >
                {m.text}
              </div>
              {!!m.keys?.length && (
                <div className="flex flex-wrap gap-[6px] mt-[6px]">
                  {m.keys.map((key) => {
                    const team = index.teams.get(key);
                    if (!team) return null;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => pickFromChat(key)}
                        title={t('showOnMap')}
                        className="inline-flex items-center gap-[6px] text-[11.5px] border border-accent text-accent bg-accent-soft rounded-full px-[11px] py-1 cursor-pointer font-semibold"
                      >
                        <span className="font-mono">{key}</span>
                        <span className="font-normal">{team.name}</span>
                        <IconPin size={11} />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {busy && (
          <div className="flex gap-1 px-3 py-2 bg-surface2 rounded-xl self-start items-center">
            <span className="w-[6px] h-[6px] rounded-full bg-muted [animation:oftype_1.1s_infinite]" />
            <span className="w-[6px] h-[6px] rounded-full bg-muted [animation:oftype_1.1s_.18s_infinite]" />
            <span className="w-[6px] h-[6px] rounded-full bg-muted [animation:oftype_1.1s_.36s_infinite]" />
          </div>
        )}
      </div>

      <div className="flex-none flex gap-2 px-[14px] py-3 border-t border-border-soft">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
          placeholder={t('chatPlaceholder', { example: placeholderExample })}
          aria-label={t('chatPlaceholder', { example: placeholderExample })}
          className="flex-1 bg-surface2 rounded-[10px] px-3 py-[9px] min-w-0 h-auto"
        />
        <button
          type="button"
          onClick={() => void send(input)}
          aria-label={t('chatTitle')}
          title={t('chatTitle')}
          className="hov-accent-bg border-none bg-accent text-accent-fg rounded-[10px] w-[38px] flex-none flex items-center justify-center cursor-pointer"
          style={{ transition: 'background .15s' }}
        >
          <IconSend size={15} />
        </button>
      </div>
    </div>
  );
}
