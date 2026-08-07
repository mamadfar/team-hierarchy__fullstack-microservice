import { describe, expect, it } from 'vitest';
import { buildIndex } from '@/lib/registry';
import { searchTeams, scoreTeam, SEARCH_LIMIT } from '@/lib/search';
import { snapshotFromSeed } from './helpers/seed';

const snapshot = snapshotFromSeed();
const index = buildIndex(snapshot);

const keysFor = (q: string) => searchTeams(snapshot.teams, index, q).map((t) => t.queueKey);

describe('search ranking (real seed, 81 teams)', () => {
  it('returns nothing for an empty/whitespace query', () => {
    expect(keysFor('')).toEqual([]);
    expect(keysFor('   ')).toEqual([]);
  });

  it('ranks an exact queue key first (score 100)', () => {
    expect(keysFor('pay-chk')[0]).toBe('PAY-CHK');
  });

  it('finds the streaming team for "kafka" via keywords/apps', () => {
    expect(keysFor('kafka')).toEqual(['DATA-STR']);
  });

  it('ranks a name prefix match ("checkout") on PAY-CHK first', () => {
    expect(keysFor('checkout')[0]).toBe('PAY-CHK');
  });

  it('ANDs whitespace tokens and sums per-token scores ("card payment")', () => {
    expect(keysFor('card payment')).toEqual(['PAY-CRD', 'PAY-POS', 'PAY-CHK']);
  });

  it('matches keywords ("gdpr" → privacy team, "invoice" → invoicing team)', () => {
    expect(keysFor('gdpr')).toEqual(['RISK-PRV']);
    expect(keysFor('invoice')[0]).toBe('PAY-INV');
  });

  it('drops teams where any token fails to match', () => {
    expect(keysFor('kafka zzzznope')).toEqual([]);
  });

  it('caps results at the top 40', () => {
    expect(keysFor('a').length).toBeLessThanOrEqual(SEARCH_LIMIT);
    expect(keysFor('a').length).toBe(40);
  });

  it('scores fields per the prototype weights', () => {
    const team = index.teams.get('PAY-CHK');
    expect(team).toBeDefined();
    if (!team) return;
    // exact key
    expect(scoreTeam(team, index, ['pay-chk'])).toBe(100);
    // key includes
    expect(scoreTeam(team, index, ['chk'])).toBe(60);
    // name prefix beats keyword/description matches
    expect(scoreTeam(team, index, ['checkout'])).toBe(70);
    // description-only token
    expect(scoreTeam(team, index, ['hosted'])).toBe(20);
    // non-match
    expect(scoreTeam(team, index, ['zzz'])).toBeNull();
  });
});
