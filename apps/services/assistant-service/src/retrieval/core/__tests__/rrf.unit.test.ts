import { describe, expect, it } from 'vitest';
import { rrfFuse } from '../rrf';

describe('rrfFuse', () => {
  it('rewards consensus across lists over a single high rank', () => {
    // "b" is ranked 2nd in both lists; "a" and "c" are each 1st in only one.
    const fused = rrfFuse([
      ['a', 'b', 'x'],
      ['c', 'b', 'y'],
    ]);
    expect(fused[0]?.id).toBe('b');
    // 2/(60+2) > 1/(60+1)
    expect(fused[0]?.score).toBeCloseTo(2 / 62, 10);
  });

  it('uses 1/(k+rank) with rank starting at 1', () => {
    const fused = rrfFuse([['only']], 60);
    expect(fused[0]?.score).toBeCloseTo(1 / 61, 10);
  });

  it('is deterministic on ties (best rank, then id)', () => {
    const fused = rrfFuse([
      ['a', 'z'],
      ['z', 'a'],
    ]);
    // identical scores and best ranks -> lexicographic
    expect(fused.map((r) => r.id)).toEqual(['a', 'z']);
  });

  it('handles a single list (vector leg degraded away)', () => {
    const fused = rrfFuse([['a', 'b', 'c']]);
    expect(fused.map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });
});
