import { describe, expect, it } from 'vitest';
import en from '../../messages/en.json';
import hu from '../../messages/hu.json';
import fr from '../../messages/fr.json';
import nl from '../../messages/nl.json';

const dictionaries = { en, hu, fr, nl } as const;

function deepKeys(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) return [prefix];
  if (value !== null && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
      deepKeys(v, prefix ? `${prefix}.${k}` : k),
    );
  }
  return [prefix];
}

describe('i18n dictionaries (en/hu/fr/nl)', () => {
  const reference = deepKeys(en).sort();

  it.each(Object.keys(dictionaries) as Array<keyof typeof dictionaries>)(
    '%s shares the exact key set with en',
    (locale) => {
      expect(deepKeys(dictionaries[locale]).sort()).toEqual(reference);
    },
  );

  it('keeps the ICU placeholders in every locale', () => {
    for (const dict of Object.values(dictionaries)) {
      expect(dict.syncedMin).toContain('{m}');
      expect(dict.ticketToast).toContain('{k}');
      expect(dict.chatPlaceholder).toContain('{example}');
      expect(dict.starterWhoHandles).toContain('{name}');
      expect(dict.starterAboutKeyword).toContain('{keyword}');
      expect(dict.starterAboutDomain).toContain('{domain}');
    }
  });

  it('has exactly 3 fallback starter questions per locale', () => {
    for (const dict of Object.values(dictionaries)) {
      expect(Array.isArray(dict.startersFallback)).toBe(true);
      expect(dict.startersFallback).toHaveLength(3);
      for (const s of dict.startersFallback) expect(typeof s).toBe('string');
    }
  });

  it('has no empty values', () => {
    for (const dict of Object.values(dictionaries)) {
      for (const [key, value] of Object.entries(dict)) {
        if (typeof value === 'string') {
          expect(value.length, `${key} must not be empty`).toBeGreaterThan(0);
        }
      }
    }
  });
});
