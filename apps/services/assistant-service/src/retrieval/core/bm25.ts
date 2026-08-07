import { tokenize } from './tokenize';

export interface Bm25Doc {
  id: string;
  text: string;
}

export interface RankedResult {
  id: string;
  score: number;
}

/**
 * Okapi BM25 (k1=1.5, b=0.75) over an in-memory corpus — a plain class with
 * zero framework/DB dependencies so the eval script can run the exact same
 * ranking code over the seed file. The corpus is ~81 team docs, so an
 * inverted index in a Map is more than fast enough; the index is rebuilt on
 * boot and whenever the registry publishes "orbit:sync:completed".
 */
export class OkapiBM25 {
  private readonly k1: number;
  private readonly b: number;

  private docIds: string[] = [];
  private docLengths = new Map<string, number>();
  /** term -> (docId -> term frequency) */
  private postings = new Map<string, Map<string, number>>();
  private avgDocLength = 0;
  private docCount = 0;

  constructor(opts: { k1?: number; b?: number } = {}) {
    this.k1 = opts.k1 ?? 1.5;
    this.b = opts.b ?? 0.75;
  }

  index(docs: Bm25Doc[]): void {
    this.docIds = [];
    this.docLengths = new Map();
    this.postings = new Map();
    let totalLength = 0;

    for (const doc of docs) {
      const tokens = tokenize(doc.text);
      this.docIds.push(doc.id);
      this.docLengths.set(doc.id, tokens.length);
      totalLength += tokens.length;
      for (const token of tokens) {
        let perDoc = this.postings.get(token);
        if (!perDoc) {
          perDoc = new Map();
          this.postings.set(token, perDoc);
        }
        perDoc.set(doc.id, (perDoc.get(doc.id) ?? 0) + 1);
      }
    }
    this.docCount = docs.length;
    this.avgDocLength = this.docCount > 0 ? totalLength / this.docCount : 0;
  }

  get size(): number {
    return this.docCount;
  }

  search(query: string, limit = 10): RankedResult[] {
    if (this.docCount === 0) return [];

    // Unique query terms with their in-query frequency.
    const queryTf = new Map<string, number>();
    for (const t of tokenize(query)) queryTf.set(t, (queryTf.get(t) ?? 0) + 1);

    const scores = new Map<string, number>();
    for (const [term, qtf] of queryTf) {
      const perDoc = this.postings.get(term);
      if (!perDoc) continue;
      const df = perDoc.size;
      const idf = Math.log(1 + (this.docCount - df + 0.5) / (df + 0.5));
      for (const [docId, tf] of perDoc) {
        const dl = this.docLengths.get(docId) ?? 0;
        const norm = tf + this.k1 * (1 - this.b + (this.b * dl) / (this.avgDocLength || 1));
        const contribution = idf * ((tf * (this.k1 + 1)) / norm) * qtf;
        scores.set(docId, (scores.get(docId) ?? 0) + contribution);
      }
    }

    return [...scores.entries()]
      .map(([id, score]) => ({ id, score }))
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
      .slice(0, limit);
  }
}
