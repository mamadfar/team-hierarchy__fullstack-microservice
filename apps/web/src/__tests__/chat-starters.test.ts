import { describe, expect, it } from 'vitest';
import type { RegistrySnapshot } from '@orbit/shared';
import { buildChatPlaceholderHint, buildChatStarters } from '@/lib/chat-starters';
import { snapshotFromSeed } from './helpers/seed';

const fill = {
  whoHandles: ({ name }: { name: string }) => `Who handles ${name}?`,
  aboutKeyword: ({ keyword }: { keyword: string }) => `Where do ${keyword} issues go?`,
  aboutDomain: ({ domain }: { domain: string }) => `Which team covers ${domain}?`,
};

const fallback = ['Who owns this queue?', 'Where should I route this ticket?', 'Which team handles this issue?'];

describe('buildChatStarters', () => {
  it('uses fallback when registry is empty or missing', () => {
    expect(buildChatStarters(null, fill, fallback)).toEqual(fallback);
    expect(buildChatStarters(undefined, fill, fallback)).toEqual(fallback);
    const empty: RegistrySnapshot = {
      ...snapshotFromSeed(),
      teams: [],
      domains: [],
    };
    expect(buildChatStarters(empty, fill, fallback)).toEqual(fallback);
  });

  it('builds chips from seed team name, keyword, and domain', () => {
    const snapshot = snapshotFromSeed();
    const starters = buildChatStarters(snapshot, fill, fallback);
    expect(starters).toHaveLength(3);
    expect(starters[0]).toBe(`Who handles ${snapshot.teams[0]!.name}?`);
    const firstKw = snapshot.teams.flatMap((t) => t.keywords).find((k) => k.trim())!;
    expect(starters[1]).toBe(`Where do ${firstKw} issues go?`);
    expect(starters[2]).toBe(`Which team covers ${snapshot.domains[0]!.name}?`);
    // Not the old hardcoded payment/GDPR prompts.
    expect(starters.join(' ')).not.toMatch(/GDPR|card payments|deploy pipeline/i);
  });

  it('reflects Helix-style entities when that is what is synced', () => {
    const base = snapshotFromSeed();
    const helix: RegistrySnapshot = {
      ...base,
      companies: [
        {
          slug: 'helix',
          name: 'Helix Commerce',
          icon: 'cart',
          hue: 215,
          description: 'Commerce',
          confluencePageId: '1',
          position: 0,
          teamCount: 1,
        },
      ],
      domains: [
        {
          slug: 'storefront',
          name: 'Storefront',
          hue: 215,
          description: '',
          position: 0,
          companySlug: 'helix',
        },
      ],
      tribes: [
        {
          slug: 'conversion',
          domainSlug: 'storefront',
          name: 'Conversion',
          position: 0,
        },
      ],
      teams: [
        {
          queueKey: 'HLX-CHK',
          name: 'Cart & Checkout',
          tribeSlug: 'conversion',
          description: 'Cart and checkout',
          icon: 'cart',
          hue: null,
          apps: ['Checkout Web'],
          keywords: ['cart stuck', 'checkout'],
          channel: '#hlx-checkout',
          lead: 'Leo',
          oncall: 'oncall',
        },
      ],
      links: [],
    };

    const starters = buildChatStarters(helix, fill, fallback);
    expect(starters).toEqual([
      'Who handles Cart & Checkout?',
      'Where do cart stuck issues go?',
      'Which team covers Storefront?',
    ]);
  });
});

describe('buildChatPlaceholderHint', () => {
  it('prefers a keyword, then team name, then fallback', () => {
    expect(buildChatPlaceholderHint(null, 'fallback')).toBe('fallback');
    const snapshot = snapshotFromSeed();
    const hint = buildChatPlaceholderHint(snapshot, 'fallback');
    expect(hint).not.toBe('fallback');
    expect(typeof hint).toBe('string');
    expect(hint.length).toBeGreaterThan(0);
  });
});
