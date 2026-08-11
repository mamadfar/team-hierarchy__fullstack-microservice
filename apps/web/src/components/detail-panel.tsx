'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import type { RegistrySnapshot } from '@orbit/shared';
import { clientEnv } from '@/env';
import { solid, tint } from '@/lib/colors';
import { copyText } from '@/lib/copy';
import { OrbitIcon } from '@/lib/icons';
import type { RegistryIndex } from '@/lib/registry';
import { useAppStore } from '@/store/app-store';
import { IconArrowUpRight, IconClose, IconCopy } from '@/components/chrome-icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export interface DetailPanelProps {
  snapshot: RegistrySnapshot;
  index: RegistryIndex;
}

/** Custom floating detail panel (not a Sheet) — right 14 / top 66 / bottom 14 / width 326. */
export function DetailPanel({ snapshot, index }: DetailPanelProps) {
  const t = useTranslations();
  const selectedKey = useAppStore((s) => s.selectedKey);
  const clearSelection = useAppStore((s) => s.clearSelection);
  const select = useAppStore((s) => s.select);
  const showToast = useAppStore((s) => s.showToast);

  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  // Focus the close button on open; return focus on close.
  useEffect(() => {
    if (selectedKey) {
      restoreRef.current = (document.activeElement as HTMLElement | null) ?? null;
      closeRef.current?.focus();
      return () => {
        restoreRef.current?.focus?.();
      };
    }
    return undefined;
  }, [selectedKey]);

  const team = selectedKey ? index.teams.get(selectedKey) : undefined;
  if (!team) return null;

  const hue = index.hueOf(team);
  const related = snapshot.links
    .filter((l) => l.source === team.queueKey || l.target === team.queueKey)
    .flatMap((l) => {
      const otherKey = l.source === team.queueKey ? l.target : l.source;
      const other = index.teams.get(otherKey);
      return other ? [{ team: other, reason: l.reason }] : [];
    });

  const onCopy = () => {
    copyText(team.queueKey);
    showToast(t('copied'));
  };
  const onCreateTicket = () => {
    if (clientEnv.ticketUrlTemplate) {
      window.open(
        clientEnv.ticketUrlTemplate.replace('{queueKey}', encodeURIComponent(team.queueKey)),
        '_blank',
        'noopener,noreferrer',
      );
    } else {
      showToast(t('ticketToast', { k: team.queueKey }));
    }
  };

  const sectionLabel =
    'text-[10.5px] font-bold tracking-[.08em] uppercase text-muted font-sora';

  return (
    <div
      role="dialog"
      aria-label={team.name}
      className="absolute right-[14px] top-[66px] bottom-[14px] w-[326px] bg-surface border border-border rounded-[14px] z-20 flex flex-col overflow-hidden anim-ofup"
      style={{ boxShadow: '0 12px 40px rgba(10,10,30,.14)' }}
    >
      <div className="flex-none px-[18px] pt-4 pb-3 border-b border-border-soft">
        <div className="flex items-start gap-[11px]">
          <span
            className="w-[38px] h-[38px] rounded-[11px] flex items-center justify-center flex-none mt-[2px]"
            style={{ background: tint(hue, 0.13) }}
          >
            <OrbitIcon name={team.icon} size={18} color={solid(hue)} />
          </span>
          <div className="flex-1 min-w-0">
            <h2 className="m-0 font-sora text-[17px] font-bold tracking-[-.01em]">{team.name}</h2>
            <div className="text-[11px] text-muted mt-[3px] whitespace-nowrap overflow-hidden text-ellipsis">
              {index.pathOf(team)}
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={clearSelection}
            aria-label={t('close')}
            title={t('close')}
            className="border-none bg-transparent cursor-pointer text-muted p-1 flex flex-none"
          >
            <IconClose size={15} />
          </button>
        </div>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className="text-xs font-mono font-semibold bg-surface2 border border-border rounded-[7px] px-[9px] py-1">
            {team.queueKey}
          </span>
          <Button variant="outline" size="sm" onClick={onCopy}>
            <IconCopy size={12} />
            {t('copy')}
          </Button>
          <Button variant="primary" size="md" onClick={onCreateTicket}>
            {t('createTicket')}
            <IconArrowUpRight size={11} />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-[18px] pt-[14px] pb-[18px] flex flex-col gap-[14px]">
        <div>
          <div className={`${sectionLabel} mb-[5px]`}>{t('description')}</div>
          <div className="leading-[1.55]">{team.description}</div>
        </div>

        <div>
          <div className={`${sectionLabel} mb-[6px]`}>{t('apps')}</div>
          <div className="flex flex-wrap gap-[6px]">
            {team.apps.map((app) => (
              <Badge key={app} variant="outline">
                {app}
              </Badge>
            ))}
          </div>
        </div>

        {team.channel && (
          <div className="flex items-baseline gap-[10px]">
            <span className="text-[11px] font-semibold text-muted w-[78px] flex-none">
              {t('channel')}
            </span>
            <span className="font-mono text-xs text-accent">{team.channel}</span>
          </div>
        )}
        {team.lead && (
          <div className="flex items-baseline gap-[10px]">
            <span className="text-[11px] font-semibold text-muted w-[78px] flex-none">
              {t('lead')}
            </span>
            <span>{team.lead}</span>
          </div>
        )}
        {team.oncall && (
          <div className="flex items-baseline gap-[10px]">
            <span className="text-[11px] font-semibold text-muted w-[78px] flex-none">
              {t('oncall')}
            </span>
            <span className="font-mono text-xs">{team.oncall}</span>
          </div>
        )}

        <div>
          <div className={`${sectionLabel} mb-[6px]`}>{t('keywords')}</div>
          <div className="flex flex-wrap gap-[5px]">
            {team.keywords.map((kw) => (
              <Badge key={kw} variant="dashed">
                {kw}
              </Badge>
            ))}
          </div>
        </div>

        {related.length > 0 && (
          <div>
            <div className={`${sectionLabel} mb-1`}>{t('related')}</div>
            <div className="flex flex-col">
              {related.map(({ team: other, reason }) => (
                <div
                  key={other.queueKey}
                  onClick={() => select(other.queueKey)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') select(other.queueKey);
                  }}
                  className="flex items-center gap-2 px-2 py-[7px] -mx-2 rounded-lg cursor-pointer hov-surface2"
                >
                  <span
                    className="w-[6px] h-[6px] rounded-full flex-none"
                    style={{ background: solid(index.hueOf(other)) }}
                  />
                  <span className="flex-1 min-w-0 whitespace-nowrap overflow-hidden text-ellipsis">
                    {other.name}
                  </span>
                  <span className="text-[10.5px] text-muted italic whitespace-nowrap overflow-hidden text-ellipsis max-w-[110px]">
                    {reason}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
