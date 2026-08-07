import type { Locale } from '@orbit/shared';

export const LOCALES: Locale[] = ['en', 'hu', 'fr', 'nl'];
export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'NEXT_LOCALE';

/** Native language names shown in the flag dropdown (per prototype). */
export const LOCALE_NATIVE_NAMES: Record<Locale, string> = {
  en: 'English',
  hu: 'Magyar',
  fr: 'Français',
  nl: 'Nederlands',
};

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as string[]).includes(value);
}
