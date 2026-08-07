import { OkapiBM25, RankedResult } from './bm25';
import { bm25TextOf, TeamDoc } from './doc-shaper';
import { rrfFuse } from './rrf';

/** Pluggable vector leg: pgvector in the service, in-memory cosine in eval. */
export interface VectorSearcher {
  search(query: string, limit: number): Promise<RankedResult[]>;
}

export interface RetrievedTeam {
  key: string;
  name: string;
  text: string;
  /** fused RRF score (relative — used for ordering + confidence heuristics). */
  score: number;
}

export interface HybridOptions {
  /** how many candidates each leg contributes to the fusion pool. */
  poolSize?: number;
  /** how many fused teams are returned (and fed to the prompt). */
  topN?: number;
  rrfK?: number;
}

/**
 * Hybrid retrieval = BM25 (lexical) + vector (semantic), fused with
 * Reciprocal Rank Fusion. Plain class, no Nest/DB: the service wires it to
 * pgvector, the eval to the in-memory index — same code path either way.
 */
export class HybridRetriever {
  private readonly bm25 = new OkapiBM25({ k1: 1.5, b: 0.75 });
  private docsByKey = new Map<string, TeamDoc>();
  private readonly poolSize: number;
  private readonly topN: number;
  private readonly rrfK: number;

  constructor(
    private readonly vectorSearcher: VectorSearcher | null,
    opts: HybridOptions = {},
  ) {
    this.poolSize = opts.poolSize ?? 24;
    this.topN = opts.topN ?? 8;
    this.rrfK = opts.rrfK ?? 60;
  }

  setDocs(docs: TeamDoc[]): void {
    this.docsByKey = new Map(docs.map((d) => [d.key, d]));
    this.bm25.index(docs.map((d) => ({ id: d.key, text: bm25TextOf(d) })));
  }

  get size(): number {
    return this.bm25.size;
  }

  getDoc(key: string): TeamDoc | undefined {
    return this.docsByKey.get(key);
  }

  async retrieve(query: string): Promise<RetrievedTeam[]> {
    const bm25Ranked = this.bm25.search(query, this.poolSize).map((r) => r.id);

    let vectorRanked: string[] = [];
    if (this.vectorSearcher) {
      try {
        vectorRanked = (await this.vectorSearcher.search(query, this.poolSize)).map((r) => r.id);
      } catch {
        // Vector leg is best-effort: degrade to BM25-only (embeddings may not
        // be written yet right after a fresh boot).
        vectorRanked = [];
      }
    }

    const lists = vectorRanked.length > 0 ? [bm25Ranked, vectorRanked] : [bm25Ranked];
    const fused = rrfFuse(lists, this.rrfK).slice(0, this.topN);

    const out: RetrievedTeam[] = [];
    for (const { id, score } of fused) {
      const doc = this.docsByKey.get(id);
      if (doc) out.push({ key: doc.key, name: doc.name, text: doc.text, score });
    }
    return out;
  }
}
