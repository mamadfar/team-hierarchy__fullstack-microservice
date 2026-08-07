import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '@orbit/shared';
import type { RetrievedTeam } from '../../retrieval/core/hybrid';
import {
  buildAnswerSystemPrompt,
  buildRewriteSystemPrompt,
  buildRewriteUserPrompt,
  findLastUserIndex,
  sanitizeRewrittenQuery,
} from '../prompts';

const teams: RetrievedTeam[] = [
  {
    key: 'PAY-CHK',
    name: 'Checkout',
    text: 'Checkout (PAY-CHK)\nNovaPay > Payments & Billing > Acceptance\nHosted checkout, card forms.\nKeywords: payment failed, 3ds',
    score: 0.03,
  },
  {
    key: 'PLT-IAM',
    name: 'IAM Platform',
    text: 'IAM Platform (PLT-IAM)\nAurora Shared Services > Core Platform > Security Engineering\nWorkforce SSO.',
    score: 0.02,
  },
];

describe('rewrite prompt', () => {
  it('instructs synonym expansion and forbids answering', () => {
    const system = buildRewriteSystemPrompt();
    expect(system).toContain('synonym');
    expect(system).toContain('login authentication SSO password sign-in');
    expect(system).toMatch(/Do NOT answer/i);
    expect(system).toMatch(/single line/i);
  });

  it('includes history as context and the last user message to rewrite', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'the checkout page is broken' },
      { role: 'assistant', content: 'Can you describe the error?' },
      { role: 'user', content: 'and who fixes that?' },
    ];
    const human = buildRewriteUserPrompt(messages);
    expect(human).toContain('the checkout page is broken');
    expect(human).toContain('Message to turn into a search query: and who fixes that?');
  });
});

describe('answer prompt', () => {
  it('grounds on candidates, requires plain text and the requested language', () => {
    const system = buildAnswerSystemPrompt({ lang: 'fr', teams });
    expect(system).toContain('French');
    expect(system).toContain('CANDIDATE TEAMS (2)');
    expect(system).toContain('PAY-CHK');
    expect(system).toContain('PLT-IAM');
    expect(system).toMatch(/Never invent/i);
    expect(system).toMatch(/no markdown/i);
    expect(system).toMatch(/2 to 4 short sentences/i);
    expect(system).toMatch(/2 closest/i);
  });

  it('supports all four locales', () => {
    for (const [lang, name] of [
      ['en', 'English'],
      ['hu', 'Hungarian'],
      ['fr', 'French'],
      ['nl', 'Dutch'],
    ] as const) {
      expect(buildAnswerSystemPrompt({ lang, teams })).toContain(name);
    }
  });
});

describe('helpers', () => {
  it('findLastUserIndex finds the last user turn', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'a' },
      { role: 'assistant', content: 'b' },
      { role: 'user', content: 'c' },
      { role: 'assistant', content: 'd' },
    ];
    expect(findLastUserIndex(messages)).toBe(2);
    expect(findLastUserIndex([])).toBe(-1);
  });

  it('sanitizeRewrittenQuery flattens whitespace, strips labels/quotes and falls back', () => {
    expect(sanitizeRewrittenQuery('"login sso\n password"', 'raw')).toBe('login sso password');
    expect(sanitizeRewrittenQuery('Query: login sso', 'raw')).toBe('login sso');
    expect(sanitizeRewrittenQuery('   ', 'raw')).toBe('raw');
    expect(sanitizeRewrittenQuery('x'.repeat(500), 'raw')).toHaveLength(300);
  });
});
