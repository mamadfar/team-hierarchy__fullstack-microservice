'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import type { Locale } from '@orbit/shared';
import { LOCALES, LOCALE_COOKIE, LOCALE_NATIVE_NAMES, isLocale } from '@/i18n/locales';
import { Flag } from '@/components/flags';
import { IconCheck, IconChevronDown } from '@/components/chrome-icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface LanguageMenuProps {
  /** Overrides the default cookie+refresh behavior (used by tests). */
  onLocaleChange?: (locale: Locale) => void;
}

/** Flag dropdown — UK/HU/FR/NL flags, native names, check on the active locale. */
export function LanguageMenu({ onLocaleChange }: LanguageMenuProps) {
  const t = useTranslations();
  const rawLocale = useLocale();
  const locale: Locale = isLocale(rawLocale) ? rawLocale : 'en';
  const router = useRouter();

  const change = (next: Locale) => {
    if (onLocaleChange) {
      onLocaleChange(next);
      return;
    }
    const secure =
      typeof window !== 'undefined' && window.location.protocol === 'https:' ? ';Secure' : '';
    document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=31536000;samesite=lax${secure}`;
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('language')}
          className="flex items-center gap-2 h-8 px-[10px] border border-border bg-surface rounded-lg cursor-pointer text-xs font-semibold hov-surface2"
          style={{ transition: 'background .15s' }}
        >
          <Flag locale={locale} />
          <span>{locale.toUpperCase()}</span>
          <IconChevronDown size={11} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LOCALES.map((l) => (
          <DropdownMenuItem key={l} onSelect={() => change(l)}>
            <Flag locale={l} />
            <span className="flex-1">{LOCALE_NATIVE_NAMES[l]}</span>
            {locale === l && <IconCheck size={13} />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
