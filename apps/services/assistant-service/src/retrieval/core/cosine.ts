import type { RankedResult } from './bm25';

export function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Tiny in-memory cosine index. Used by the eval script (and unit tests) as
 * the stand-in for pgvector so the whole retrieval pipeline runs without a
 * database.
 */
export class InMemoryVectorIndex {
  private entries: Array<{ id: string; vector: number[] }> = [];

  set(entries: Array<{ id: string; vector: number[] }>): void {
    this.entries = entries;
  }

  search(query: number[], limit = 10): RankedResult[] {
    return this.entries
      .map((e) => ({ id: e.id, score: cosineSimilarity(query, e.vector) }))
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
      .slice(0, limit);
  }
}
