'use client';

import { useEffect, useReducer } from 'react';
import { useTranslations } from 'next-intl';
import type { RegistrySnapshot, Team } from '@orbit/shared';
import { solid, tint } from '@/lib/colors';
import { OrbitIcon } from '@/lib/icons';
import { domainsOfCompany, tribesOfDomain, type RegistryIndex, companiesInOrder } from '@/lib/registry';
import { useAppStore } from '@/store/app-store';
import { OrbitLogo } from '@/components/logo';
import { IconChevronDown, IconClose, IconDatabase, IconRefresh, IconSearch } from '@/components/chrome-icons';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export const SEARCH_INPUT_ID = 'orbit-search';

export interface SidebarProps {
  snapshot: RegistrySnapshot | null;
  index: RegistryIndex | null;
  /** Ranked search results; null when not searching. */
  results: Team[] | null;
  onRefresh: () => void;
}

export function Sidebar({ snapshot, index, results, onRefresh }: SidebarProps) {
  const t = useTranslations();
  const collapsed = useAppStore((s) => s.collapsed);
  const q = useAppStore((s) => s.q);
  const setQ = useAppStore((s) => s.setQ);
  const searching = q.trim().length > 0;

  return (
    <aside
      className="flex-none min-h-0 h-full overflow-hidden bg-surface flex"
      style={{
        width: collapsed ? 0 : 296,
        transition: 'width .25s ease',
        borderRight: collapsed ? 'none' : '1px solid var(--border)',
      }}
    >
      <div className="w-[296px] flex-none flex flex-col min-h-0 h-full">
        {/* Logo + wordmark + tagline */}
        <div className="flex items-center gap-[10px] px-4 pt-4 pb-3">
          <OrbitLogo size={32} />
          <div className="flex flex-col">
            <span className="font-sora text-lg font-bold leading-none tracking-[-.01em]">Orbit</span>
            <span className="text-[11px] text-muted mt-[3px]">{t('tagline')}</span>
          </div>
        </div>

        {/* Search */}
        <div className="px-[14px] pb-2">
          <div className="relative">
            <IconSearch
              size={14}
              style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }}
            />
            <Input
              id={SEARCH_INPUT_ID}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('search')}
              aria-label={t('search')}
              className="h-[34px] rounded-[9px] pl-[33px] pr-8"
            />
            {searching ? (
              <button
                type="button"
                onClick={() => setQ('')}
                aria-label={t('clearSearch')}
                title={t('clearSearch')}
                className="absolute right-[9px] top-1/2 -translate-y-1/2 border-none bg-transparent cursor-pointer text-muted p-[2px] flex"
              >
                <IconClose size={13} strokeWidth={2.4} />
              </button>
            ) : (
              <span className="absolute right-[9px] top-1/2 -translate-y-1/2 text-[10px] text-muted border border-border rounded px-[5px] leading-4">
                /
              </span>
            )}
          </div>
          <div className="text-[11px] text-muted pt-2 px-[2px]">
            {snapshot
              ? `${snapshot.teams.length} ${t('teams')} · ${snapshot.domains.length} ${t('domains')} · ${snapshot.companies.length} ${t('companies')}`
              : ''}
          </div>
        </div>

        {/* Tree / results */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="pt-[2px] px-2 pb-2">
            {snapshot && index && searching ? (
              <SearchResults index={index} results={results ?? []} />
            ) : snapshot && index ? (
              <Tree snapshot={snapshot} index={index} />
            ) : null}
          </div>
        </ScrollArea>

        <SourceFooter snapshot={snapshot} onRefresh={onRefresh} />
      </div>
    </aside>
  );
}

function SearchResults({ index, results }: { index: RegistryIndex; results: Team[] }) {
  const t = useTranslations();
  const select = useAppStore((s) => s.select);
  return (
    <div className="flex flex-col gap-[2px]">
      <div className="text-[10.5px] font-bold tracking-[.08em] uppercase text-muted px-2 pt-[6px] pb-1 font-sora">
        {t('results')} ({results.length})
      </div>
      {results.length === 0 && (
        <div className="text-muted px-2 py-[10px] italic">{t('noResults')}</div>
      )}
      {results.map((team) => {
        const tribe = index.tribeOf(team);
        const domain = index.domainOf(team);
        const hue = index.hueOf(team);
        return (
          <div
            key={team.queueKey}
            onClick={() => select(team.queueKey)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') select(team.queueKey);
            }}
            className="flex flex-col gap-[2px] px-2 py-[7px] rounded-lg cursor-pointer hov-surface2"
          >
            <div className="flex items-center gap-2 min-w-0">
              <OrbitIcon name={team.icon} size={13} color={solid(hue)} className="flex-none" />
              <span className="font-semibold whitespace-nowrap overflow-hidden text-ellipsis flex-1">
                {team.name}
              </span>
              <span className="text-[10px] font-mono text-muted">{team.queueKey}</span>
            </div>
            <div className="text-[11px] text-muted pl-[21px] whitespace-nowrap overflow-hidden text-ellipsis">
              {tribe.name} · {domain.name}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Tree({ snapshot, index }: { snapshot: RegistrySnapshot; index: RegistryIndex }) {
  const selectedKey = useAppStore((s) => s.selectedKey);
  const aiKeys = useAppStore((s) => s.aiKeys);
  const expandedDomains = useAppStore((s) => s.expandedDomains);
  const toggleDomain = useAppStore((s) => s.toggleDomain);
  const select = useAppStore((s) => s.select);

  return (
    <>
      {companiesInOrder(snapshot).map((company) => (
        <div key={company.slug} className="mb-1">
          <div className="flex items-center gap-2 px-2 pt-[10px] pb-[5px]">
            <span
              className="w-[22px] h-[22px] rounded-[7px] flex items-center justify-center flex-none"
              style={{ background: tint(company.hue, 0.13) }}
            >
              <OrbitIcon name={company.icon} size={12} color={solid(company.hue)} strokeWidth={2.2} />
            </span>
            <span className="font-sora text-[11px] font-bold tracking-[.06em] uppercase flex-1 whitespace-nowrap overflow-hidden text-ellipsis">
              {company.name}
            </span>
            <span className="text-[10.5px] text-muted">{company.teamCount}</span>
          </div>
          {domainsOfCompany(snapshot, company.slug).map((domain) => {
            const tribes = tribesOfDomain(snapshot, domain.slug);
            const count = tribes.reduce(
              (n, tr) => n + (index.teamsByTribe.get(tr.slug)?.length ?? 0),
              0,
            );
            const expanded = !!expandedDomains[domain.slug];
            return (
              <Collapsible
                key={domain.slug}
                open={expanded}
                onOpenChange={() => toggleDomain(domain.slug)}
              >
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 px-2 py-[7px] rounded-lg cursor-pointer hov-surface2 border-none bg-transparent text-left"
                  >
                    <span
                      className="w-2 h-2 rounded-[3px] flex-none"
                      style={{ background: solid(domain.hue) }}
                    />
                    <span className="font-sora font-semibold text-[12.5px] flex-1 whitespace-nowrap overflow-hidden text-ellipsis">
                      {domain.name}
                    </span>
                    <span className="text-[10.5px] text-muted">{count}</span>
                    <IconChevronDown
                      size={12}
                      style={{
                        transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform .15s',
                      }}
                    />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="flex flex-col gap-[1px] pb-[6px]">
                    {tribes.map((tribe) => (
                      <div key={tribe.slug}>
                        <div className="text-[10px] font-bold tracking-[.07em] uppercase text-muted pt-[7px] pb-[3px] pl-6 pr-2">
                          {tribe.name}
                        </div>
                        {(index.teamsByTribe.get(tribe.slug) ?? []).map((team) => {
                          const hue = index.hueOf(team);
                          const isSel =
                            selectedKey === team.queueKey || aiKeys.includes(team.queueKey);
                          return (
                            <div
                              key={team.queueKey}
                              onClick={() => select(team.queueKey)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') select(team.queueKey);
                              }}
                              className="flex items-center gap-2 py-[5px] pl-6 pr-2 rounded-[7px] cursor-pointer hov-surface2"
                              style={{ background: isSel ? 'var(--accent-soft)' : undefined }}
                            >
                              <OrbitIcon
                                name={team.icon}
                                size={12}
                                color={solid(hue)}
                                className="flex-none opacity-90"
                              />
                              <span className="whitespace-nowrap overflow-hidden text-ellipsis flex-1">
                                {team.name}
                              </span>
                              <span className="text-[10px] font-mono text-muted">{team.queueKey}</span>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      ))}
    </>
  );
}

function SourceFooter({
  snapshot,
  onRefresh,
}: {
  snapshot: RegistrySnapshot | null;
  onRefresh: () => void;
}) {
  const t = useTranslations();
  const syncing = useAppStore((s) => s.syncing);
  const syncCooldownUntil = useAppStore((s) => s.syncCooldownUntil);
  const refreshBlocked = syncing || syncCooldownUntil > Date.now();
  return (
    <Card className="flex-none rounded-none border-0 border-t border-border bg-surface2 px-[14px] py-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <IconDatabase size={15} />
        <span className="font-semibold text-xs flex-1">{t('source')}: Confluence</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshBlocked}
              aria-busy={syncing || undefined}
              aria-label={refreshBlocked ? t('syncRateLimited') : t('refresh')}
              title={refreshBlocked ? t('syncRateLimited') : t('refresh')}
              className="border border-border bg-surface rounded-[7px] w-[26px] h-[26px] flex items-center justify-center text-muted hov-accent-line disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed"
              style={{ transition: 'border-color .15s, color .15s' }}
            >
              <IconRefresh size={13} className={syncing ? 'anim-spin-orbit' : undefined} />
            </button>
          </TooltipTrigger>
          <TooltipContent>{refreshBlocked ? t('syncRateLimited') : t('refresh')}</TooltipContent>
        </Tooltip>
      </div>
      <div className="flex flex-col gap-1">
        {(snapshot ? companiesInOrder(snapshot) : []).map((company) => (
          <div key={company.slug} className="flex items-center gap-[7px]">
            <span
              className="w-[6px] h-[6px] rounded-full flex-none"
              style={{ background: solid(company.hue) }}
            />
            <span className="text-[11.5px] flex-1 whitespace-nowrap overflow-hidden text-ellipsis">
              {company.name}
            </span>
            <span className="text-[10px] font-mono text-muted">{company.confluencePageId}</span>
          </div>
        ))}
      </div>
      <div className="text-[10px] font-mono text-muted">ORG · env CONFLUENCE_PAGE_IDS</div>
      <div className="flex items-center justify-between text-[11px] text-muted">
        <SyncedLabel lastSync={snapshot?.lastSync ?? null} />
        <span className="inline-flex items-center gap-1">
          <span className="w-[6px] h-[6px] rounded-full bg-[#22c07a]" />
          {t('live')}
        </span>
      </div>
      <div className="text-[10.5px] text-muted leading-[1.45] border-t border-dashed border-border pt-2">
        {t('readOnly')}
      </div>
    </Card>
  );
}

/** "Synced just now" / "Synced {m} min ago", re-evaluated every 20 seconds. */
function SyncedLabel({ lastSync }: { lastSync: string | null }) {
  const t = useTranslations();
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const id = setInterval(tick, 20000);
    return () => clearInterval(id);
  }, []);
  const mins = lastSync ? Math.round((Date.now() - Date.parse(lastSync)) / 60000) : 0;
  return <span>{mins < 1 ? t('syncedJust') : t('syncedMin', { m: mins })}</span>;
}
