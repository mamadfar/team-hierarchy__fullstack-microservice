import { Embeddings } from '@langchain/core/embeddings';
import { tokenize } from '../retrieval/core/tokenize';

/**
 * Deterministic, fully-offline embedding: the classic "hashing trick".
 *
 * Features = word tokens (weight 2) + character 3-grams of each token with
 * boundary markers (weight 1). Each feature is FNV-1a hashed into one of
 * `dimensions` buckets with a hash-derived sign, then the vector is
 * L2-normalized. Properties we rely on:
 *   - same text => byte-identical vector (no RNG, no state),
 *   - texts sharing tokens land in the same buckets => cosine similarity of
 *     overlapping-token texts is strictly higher than disjoint ones (signed
 *     hashing keeps disjoint texts near 0),
 *   - char n-grams give a little morphological fuzziness ("charge" vs
 *     "chargeback") on top of exact token overlap.
 *
 * This is the default provider so dev/CI/eval run with zero API keys.
 */
export class MockEmbeddings extends Embeddings {
  constructor(private readonly dimensions = 1536) {
    super({});
  }

  embed(text: string): number[] {
    const vec = new Array<number>(this.dimensions).fill(0);
    for (const token of tokenize(text)) {
      this.addFeature(vec, `w:${token}`, 2);
      const padded = `^${token}$`;
      for (let i = 0; i <= padded.length - 3; i++) {
        this.addFeature(vec, `g:${padded.slice(i, i + 3)}`, 1);
      }
    }
    return l2Normalize(vec);
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    return documents.map((d) => this.embed(d));
  }

  async embedQuery(document: string): Promise<number[]> {
    return this.embed(document);
  }

  private addFeature(vec: number[], feature: string, weight: number): void {
    const h = fnv1a(feature);
    const idx = h % this.dimensions;
    const sign = (h >>> 15) & 1 ? 1 : -1;
    vec[idx] = (vec[idx] ?? 0) + sign * weight;
  }
}

/** 32-bit FNV-1a hash (unsigned). */
export function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function l2Normalize(vec: number[]): number[] {
  let sum = 0;
  for (const v of vec) sum += v * v;
  if (sum === 0) {
    const unit = new Array<number>(vec.length).fill(0);
    if (unit.length > 0) unit[0] = 1;
    return unit;
  }
  const norm = Math.sqrt(sum);
  return vec.map((v) => v / norm);
}
