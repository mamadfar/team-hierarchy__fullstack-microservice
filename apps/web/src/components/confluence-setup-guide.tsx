'use client';

import { useTranslations } from 'next-intl';
import { useAppStore } from '@/store/app-store';
import { IconClose, IconCopy } from '@/components/chrome-icons';
import { Button } from '@/components/ui/button';
import { copyText } from '@/lib/copy';
import { CONFLUENCE_SAMPLE_MARKDOWN } from '@/lib/confluence-sample';
import type { SyncErrorKind } from '@/lib/sync-error';

/**
 * Shown when the registry has no teams, or sync failed.
 * Structure/parse → required tables + Copy sample.
 * Auth/config → actionable .env / Atlassian steps (no sample as primary fix).
 */
export function ConfluenceSetupGuide({
  reason,
  detail,
  kind = 'structure',
  blocking = false,
}: {
  /** Why we're showing the guide. */
  reason: 'empty' | 'sync';
  /** Upstream sync/parse message when available. */
  detail?: string | null;
  /** structure = page tables; config = env/credentials. */
  kind?: SyncErrorKind;
  /** Full-screen block (empty registry) vs dismissible overlay. */
  blocking?: boolean;
}) {
  const t = useTranslations();
  const closeSetupGuide = useAppStore((s) => s.closeSetupGuide);
  const showToast = useAppStore((s) => s.showToast);
  const isConfig = kind === 'config';

  const onCopySample = () => {
    copyText(CONFLUENCE_SAMPLE_MARKDOWN);
    showToast(t('sampleCopied'));
  };

  const title = isConfig
    ? t('syncConfigTitle')
    : reason === 'empty'
      ? t('registryEmptyTitle')
      : t('syncStructureTitle');
  const body = isConfig
    ? t('syncConfigBody')
    : reason === 'empty'
      ? t('registryEmptyBody')
      : t('syncStructureBody');

  return (
    <div
      className={
        blocking
          ? 'absolute inset-0 z-[20] bg-bg overflow-y-auto'
          : 'absolute inset-0 z-[20] bg-bg/85 backdrop-blur-[2px] overflow-y-auto'
      }
      role="alertdialog"
      aria-labelledby="orbit-confluence-guide-title"
      aria-modal="true"
    >
      <div className="max-w-[640px] mx-auto px-5 py-8 flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h2
              id="orbit-confluence-guide-title"
              className="font-sora font-bold text-[15px] tracking-[-.01em]"
            >
              {title}
            </h2>
            <p className="text-[12.5px] text-muted mt-1.5 leading-relaxed">{body}</p>
            {detail ? (
              <p className="text-[12px] mt-2 px-3 py-2 rounded-lg bg-surface2 border border-border-soft font-mono leading-snug whitespace-pre-wrap">
                {detail}
              </p>
            ) : null}
          </div>
          {!blocking && (
            <button
              type="button"
              onClick={closeSetupGuide}
              aria-label={t('close')}
              title={t('close')}
              className="border-none bg-transparent cursor-pointer text-muted p-1 flex flex-none"
            >
              <IconClose size={14} />
            </button>
          )}
        </div>

        {isConfig ? (
          <section className="flex flex-col gap-2">
            <h3 className="font-sora font-semibold text-[12.5px]">{t('confluenceConfigChecklist')}</h3>
            <ul className="text-[12px] leading-relaxed text-text list-disc pl-4 space-y-1.5">
              <li>{t('confluenceConfigRuleBaseUrl')}</li>
              <li>{t('confluenceConfigRuleEmail')}</li>
              <li>{t('confluenceConfigRuleToken')}</li>
              <li>{t('confluenceConfigRulePageIds')}</li>
              <li>{t('confluenceConfigRuleMock')}</li>
            </ul>
            <p className="text-[11.5px] text-muted leading-relaxed mt-1">{t('confluenceConfigHowTo')}</p>
          </section>
        ) : (
          <>
            <section className="flex flex-col gap-2">
              <h3 className="font-sora font-semibold text-[12.5px]">{t('confluenceGuideRequired')}</h3>
              <ul className="text-[12px] leading-relaxed text-text list-disc pl-4 space-y-1">
                <li>{t('confluenceGuideRulePage')}</li>
                <li>{t('confluenceGuideRuleConfig')}</li>
                <li>{t('confluenceGuideRuleTeams')}</li>
                <li>{t('confluenceGuideRuleQueue')}</li>
                <li>{t('confluenceGuideRuleIcon')}</li>
                <li>{t('confluenceGuideRuleOptional')}</li>
              </ul>
            </section>

            <section className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="font-sora font-semibold text-[12.5px] m-0">
                  {t('confluenceGuideExampleTitle')}
                </h3>
                <Button type="button" variant="outline" size="sm" onClick={onCopySample}>
                  <IconCopy size={12} />
                  {t('copySample')}
                </Button>
              </div>
              <ExampleTable
                caption={t('confluenceGuideConfigCaption')}
                headers={[t('confluenceColKey'), t('confluenceColValue')]}
                rows={[
                  [t('confluenceExConfigNameKey'), t('confluenceExConfigNameVal')],
                  [t('confluenceExConfigIconKey'), t('confluenceExConfigIconVal')],
                  [t('confluenceExConfigColorKey'), t('confluenceExConfigColorVal')],
                ]}
              />
              <ExampleTable
                caption={t('confluenceGuideTeamsCaption')}
                headers={[
                  t('confluenceColTeamName'),
                  t('confluenceColQueueKey'),
                  t('confluenceColTribe'),
                  t('confluenceColDomain'),
                ]}
                rows={[
                  [
                    t('confluenceExTeam1Name'),
                    t('confluenceExTeam1Key'),
                    t('confluenceExTeam1Tribe'),
                    t('confluenceExTeam1Domain'),
                  ],
                  [
                    t('confluenceExTeam2Name'),
                    t('confluenceExTeam2Key'),
                    t('confluenceExTeam2Tribe'),
                    t('confluenceExTeam2Domain'),
                  ],
                ]}
              />
            </section>
          </>
        )}

        <p className="text-[11.5px] text-muted leading-relaxed">{t('confluenceGuideDocsHint')}</p>
      </div>
    </div>
  );
}

function ExampleTable({
  caption,
  headers,
  rows,
}: {
  caption: string;
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="rounded-xl border border-border overflow-hidden bg-surface">
      <div className="px-3 py-2 text-[11px] font-semibold text-muted border-b border-border-soft bg-surface2">
        {caption}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11.5px] border-collapse">
          <thead>
            <tr>
              {headers.map((h) => (
                <th
                  key={h}
                  className="text-left font-semibold px-3 py-1.5 border-b border-border-soft whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className="px-3 py-1.5 border-b border-border-soft font-mono whitespace-nowrap"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
