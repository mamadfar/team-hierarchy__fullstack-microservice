'use client';

import { useTranslations } from 'next-intl';

/** Full-canvas first-load overlay: spinner ring + "Fetching from Confluence…". */
export function LoadingOverlay() {
  const t = useTranslations();
  return (
    <div className="absolute top-[53px] left-0 right-0 bottom-0 z-[15] bg-bg flex flex-col items-center justify-center gap-[14px]">
      <div
        className="w-[38px] h-[38px] rounded-full anim-spin-orbit"
        style={{ border: '3px solid var(--accent-soft)', borderTopColor: 'var(--accent)' }}
      />
      <div className="font-sora font-semibold text-[13.5px]">{t('loading')}</div>
      <div className="text-[11px] text-muted font-mono">ORG · 3 {t('tables')} · CONFLUENCE_PAGE_IDS</div>
    </div>
  );
}
