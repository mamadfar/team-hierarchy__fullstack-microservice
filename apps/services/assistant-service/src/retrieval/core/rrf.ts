import type { RankedResult } from './bm25';

/**
 * Reciprocal Rank Fusion: score(d) = Σ_lists 1 / (k + rank_d), rank starting
 * at 1, k = 60 (the constant from the original Cormack/Clarke paper — keeps
 * a runaway #1 in one list from drowning consensus across lists).
 * Deterministic tie-break: better best-rank first, then lexicographic id.
 */
export function rrfFuse(lists: string[][], k = 60): RankedResult[] {
  const scores = new Map<string, number>();
  const bestRank = new Map<string, number>();

  for (const list of lists) {
    for (let i = 0; i < list.length; i++) {
      const id = list[i];
      if (id === undefined) continue;
      const rank = i + 1;
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + rank));
      const prev = bestRank.get(id);
      if (prev === undefined || rank < prev) bestRank.set(id, rank);
    }
  }

  return [...scores.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        (bestRank.get(a.id) ?? Infinity) - (bestRank.get(b.id) ?? Infinity) ||
        a.id.localeCompare(b.id),
    );
}
