import { describe, expect, it } from 'vitest';
import { LocaleSchema } from '@orbit/shared';
import type { RetrievedTeam } from '../../retrieval/core/hybrid';
import { buildFallbackResponse, buildNoMatchResponse } from '../fallback';

const retrieved: RetrievedTeam[] = [
  { key: 'PAY-CHK', name: 'Checkout', text: '...', score: 0.03 },
  { key: 'PAY-CRD', name: 'Card Processing', text: '...', score: 0.02 },
  { key: 'PAY-REC', name: 'Reconciliation', text: '...', score: 0.01 },
];

describe('deterministic fallback answers (no GEMINI_API_KEY)', () => {
  it('names the top-2 teams with queue keys, max 2 team refs', () => {
    const res = buildFallbackResponse('en', retrieved);
    expect(res.answer).toContain('Checkout (PAY-CHK)');
    expect(res.answer).toContain('Card Processing (PAY-CRD)');
    expect(res.teams.map((t) => t.queueKey)).toEqual(['PAY-CHK', 'PAY-CRD']);
    expect(res.teams.length).toBeLessThanOrEqual(3);
  });

  it('answers in every supported locale without markdown', () => {
    for (const lang of LocaleSchema.options) {
      const res = buildFallbackResponse(lang, retrieved);
      expect(res.answer).toContain('PAY-CHK');
      expect(res.answer).not.toMatch(/[*#_`]/);
      expect(res.answer.length).toBeGreaterThan(20);
    }
  });

  it('handles a single retrieved team', () => {
    const res = buildFallbackResponse('en', retrieved.slice(0, 1));
    expect(res.teams).toHaveLength(1);
    expect(res.answer).toContain('Checkout (PAY-CHK)');
  });

  it('has a localized no-match answer with no teams', () => {
    for (const lang of LocaleSchema.options) {
      const res = buildNoMatchResponse(lang);
      expect(res.teams).toEqual([]);
      expect(res.answer.length).toBeGreaterThan(10);
    }
    const empty = buildFallbackResponse('en', []);
    expect(empty.teams).toEqual([]);
  });
});
