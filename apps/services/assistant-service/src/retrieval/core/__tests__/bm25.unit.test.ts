import { describe, expect, it } from 'vitest';
import { OkapiBM25 } from '../bm25';
import { bm25TextOf, seedToTeamDocs } from '../doc-shaper';
import { loadSeedFile } from '../seed';
import { tokenize } from '../tokenize';

describe('tokenize', () => {
  it('lowercases and splits on non-alphanumerics', () => {
    expect(tokenize('Apple-Pay 3DS!')).toContain('apple');
    expect(tokenize('Apple-Pay 3DS!')).toContain('pay');
    expect(tokenize('Apple-Pay 3DS!')).toContain('3ds');
  });

  it('emits singular variants for plural-ish tokens', () => {
    const tokens = tokenize('payouts');
    expect(tokens).toContain('payouts');
    expect(tokens).toContain('payout');
    // no bogus stripping of short or -ss words
    expect(tokenize('vpn')).toEqual(['vpn']);
    expect(tokenize('press')).toEqual(['press']);
  });

  it('drops function words but keeps signal words', () => {
    expect(tokenize('the wifi in the office is down')).toEqual(['wifi', 'office', 'down']);
  });
});

describe('OkapiBM25', () => {
  it('ranks by term relevance with tf saturation and idf', () => {
    const bm25 = new OkapiBM25();
    bm25.index([
      { id: 'a', text: 'kafka streaming topics and event schemas' },
      { id: 'b', text: 'invoice generation and credit notes' },
      { id: 'c', text: 'kafka kafka kafka unrelated words here' },
    ]);
    const results = bm25.search('kafka streaming');
    expect(results[0]?.id).toBe('a');
    expect(results.map((r) => r.id)).not.toContain('b');
  });

  it('returns empty results on an empty index or no-overlap query', () => {
    const empty = new OkapiBM25();
    expect(empty.search('anything')).toEqual([]);

    const bm25 = new OkapiBM25();
    bm25.index([{ id: 'a', text: 'hello world' }]);
    expect(bm25.search('zzz qqq')).toEqual([]);
  });

  it('ranks DATA-STR first for "kafka lag" over the real seed docs', () => {
    const docs = seedToTeamDocs(loadSeedFile());
    expect(docs.length).toBeGreaterThanOrEqual(80);

    const bm25 = new OkapiBM25({ k1: 1.5, b: 0.75 });
    bm25.index(docs.map((d) => ({ id: d.key, text: bm25TextOf(d) })));

    expect(bm25.search('kafka lag')[0]?.id).toBe('DATA-STR');
    expect(bm25.search('the wifi in the office is down')[0]?.id).toBe('OPS-IT');
    expect(bm25.search('PAY-CHK')[0]?.id).toBe('PAY-CHK');
  });
});
