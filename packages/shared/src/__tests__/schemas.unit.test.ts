import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ChatRequestSchema,
  QueueKeySchema,
  SeedFileSchema,
  TeamSchema,
} from '../schemas';
import { normalizeIconName } from '../icons';

describe('QueueKeySchema', () => {
  it('accepts real keys', () => {
    for (const k of ['PAY-CHK', 'CG-IAM2', 'RISK-BOT', 'DATA-ING']) {
      expect(QueueKeySchema.safeParse(k).success).toBe(true);
    }
  });
  it('rejects malformed keys', () => {
    for (const k of ['pay-chk', 'PAYCHK', 'PAY_CHK', '-CHK', 'PAY-']) {
      expect(QueueKeySchema.safeParse(k).success).toBe(false);
    }
  });
});

describe('TeamSchema', () => {
  it('requires hue null or 0-360', () => {
    const base = {
      queueKey: 'PAY-CHK',
      name: 'Checkout',
      tribeSlug: 'pay-acc',
      description: 'x',
      icon: 'cart',
      apps: [],
      keywords: [],
      channel: null,
      lead: null,
      oncall: null,
    };
    expect(TeamSchema.safeParse({ ...base, hue: null }).success).toBe(true);
    expect(TeamSchema.safeParse({ ...base, hue: 360 }).success).toBe(true);
    expect(TeamSchema.safeParse({ ...base, hue: 361 }).success).toBe(false);
  });
});

describe('ChatRequestSchema', () => {
  it('defaults lang to en and caps history', () => {
    const ok = ChatRequestSchema.parse({ messages: [{ role: 'user', content: 'hi' }] });
    expect(ok.lang).toBe('en');
    const tooMany = Array.from({ length: 21 }, () => ({ role: 'user' as const, content: 'x' }));
    expect(ChatRequestSchema.safeParse({ messages: tooMany }).success).toBe(false);
  });
});

describe('seed fixture', () => {
  it('validates against SeedFileSchema and has unique queue keys', () => {
    const raw = readFileSync(
      join(__dirname, '../../../../infra/db/seed/registry.json'),
      'utf8',
    );
    const seed = SeedFileSchema.parse(JSON.parse(raw));
    const keys = seed.companies.flatMap((c) => c.teams.map((t) => t.queueKey));
    expect(keys.length).toBeGreaterThanOrEqual(80);
    expect(new Set(keys).size).toBe(keys.length);
    for (const link of seed.links) {
      expect(keys).toContain(link.source);
      expect(keys).toContain(link.target);
    }
  });
});

describe('normalizeIconName', () => {
  it('falls back to box for unknown names', () => {
    expect(normalizeIconName('cart')).toBe('cart');
    expect(normalizeIconName('WALLET')).toBe('wallet');
    expect(normalizeIconName('nope')).toBe('box');
    expect(normalizeIconName(null)).toBe('box');
  });
});
