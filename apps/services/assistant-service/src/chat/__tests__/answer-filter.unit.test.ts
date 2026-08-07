import { describe, expect, it } from 'vitest';
import type { RetrievedTeam } from '../../retrieval/core/hybrid';
import { filterAnswerTeams } from '../answer-filter';

const retrieved: RetrievedTeam[] = [
  { key: 'PAY-CHK', name: 'Checkout', text: '...', score: 0.03 },
  { key: 'PAY-CRD', name: 'Card Processing', text: '...', score: 0.02 },
  { key: 'PAY-REC', name: 'Reconciliation', text: '...', score: 0.015 },
  { key: 'PLT-IAM', name: 'IAM Platform', text: '...', score: 0.01 },
];

describe('filterAnswerTeams (grounding enforcement)', () => {
  it('drops invented keys that were not retrieved', () => {
    const out = filterAnswerTeams(
      {
        teams: [
          { queueKey: 'PAY-CHK', confidence: 0.9 },
          { queueKey: 'FAKE-KEY', confidence: 0.99 },
        ],
      },
      retrieved,
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.queueKey).toBe('PAY-CHK');
  });

  it('fills the public team name from the registry rows, not the model', () => {
    const out = filterAnswerTeams({ teams: [{ queueKey: 'pay-crd', confidence: 0.5 }] }, retrieved);
    expect(out[0]?.name).toBe('Card Processing');
    expect(out[0]?.queueKey).toBe('PAY-CRD');
  });

  it('normalizes case/whitespace, dedupes and caps at 3', () => {
    const out = filterAnswerTeams(
      {
        teams: [
          { queueKey: ' pay-chk ', confidence: 0.9 },
          { queueKey: 'PAY-CHK', confidence: 0.8 },
          { queueKey: 'PAY-CRD', confidence: 0.7 },
          { queueKey: 'PAY-REC', confidence: 0.6 },
          { queueKey: 'PLT-IAM', confidence: 0.5 },
        ],
      },
      retrieved,
    );
    expect(out.map((t) => t.queueKey)).toEqual(['PAY-CHK', 'PAY-CRD', 'PAY-REC']);
  });

  it('clamps confidence into [0,1]', () => {
    const out = filterAnswerTeams(
      {
        teams: [
          { queueKey: 'PAY-CHK', confidence: 7 },
          { queueKey: 'PAY-CRD', confidence: -1 },
        ],
      },
      retrieved,
    );
    expect(out[0]?.confidence).toBe(1);
    expect(out[1]?.confidence).toBe(0);
  });

  it('returns empty for empty drafts', () => {
    expect(filterAnswerTeams({ teams: [] }, retrieved)).toEqual([]);
  });
});
