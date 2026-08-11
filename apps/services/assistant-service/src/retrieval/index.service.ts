import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import type { Embeddings } from '@langchain/core/embeddings';
import { EMBEDDING_DIMENSIONS } from '../embeddings/embeddings.factory';
import { EMBEDDINGS } from '../embeddings/embeddings.module';
import { HybridRetriever, RetrievedTeam } from './core/hybrid';
import type { TeamDoc } from './core/doc-shaper';
import { DocumentBuilderService } from './document-builder.service';
import { PgVectorSearcher } from './pgvector.searcher';

/**
 * Owns the in-memory retrieval state:
 *  - BM25 index over the team docs (rebuilt on boot + on every
 *    "orbit:sync:completed" Redis event),
 *  - embedding upkeep: we re-embed ALL docs on every rebuild instead of
 *    hashing/diffing content. The dataset is ~81 short docs; even for paid
 *    providers that is centicents per sync, and it makes provider/model
 *    switches and content edits self-healing with zero bookkeeping.
 *
 * registry-service owns the DDL, so on boot the tables (or the rows) may not
 * exist yet under docker compose — we log and retry with capped exponential
 * backoff instead of crashing.
 */
@Injectable()
export class IndexService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(IndexService.name);
  private readonly retriever: HybridRetriever;
  private ready = false;
  private rebuilding = false;
  /** Set when a sync arrives mid-rebuild so we rerun once the current rebuild finishes. */
  private pendingRebuild = false;
  private retryTimer: NodeJS.Timeout | null = null;
  private retryAttempt = 0;
  private shuttingDown = false;

  constructor(
    // Explicit @Inject everywhere: dev/test toolchains (tsx, vitest) compile
    // via esbuild, which does not emit design:paramtypes metadata.
    @Inject(DocumentBuilderService) private readonly documents: DocumentBuilderService,
    @Inject(PgVectorSearcher) pgVectorSearcher: PgVectorSearcher,
    @Inject(EMBEDDINGS) private readonly embeddings: Embeddings,
  ) {
    this.retriever = new HybridRetriever(pgVectorSearcher, { poolSize: 24, topN: 8, rrfK: 60 });
  }

  onApplicationBootstrap(): void {
    void this.rebuildWithRetry();
  }

  onApplicationShutdown(): void {
    this.shuttingDown = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
  }

  get isReady(): boolean {
    return this.ready;
  }

  get docCount(): number {
    return this.retriever.size;
  }

  async retrieve(query: string): Promise<RetrievedTeam[]> {
    return this.retriever.retrieve(query);
  }

  getDoc(key: string): TeamDoc | undefined {
    return this.retriever.getDoc(key);
  }

  /** Public entry used by boot + the sync listener. Serialized; failures schedule a retry. */
  async rebuildWithRetry(): Promise<void> {
    if (this.shuttingDown) return;
    if (this.rebuilding) {
      this.pendingRebuild = true;
      return;
    }
    this.rebuilding = true;
    try {
      do {
        this.pendingRebuild = false;
        try {
          await this.rebuild();
          this.retryAttempt = 0;
        } catch (err) {
          const delayMs = Math.min(30_000, 2_000 * 2 ** this.retryAttempt);
          this.retryAttempt += 1;
          this.logger.warn(
            `index rebuild failed (registry may still be booting/seeding): ${
              err instanceof Error ? err.message : String(err)
            } — retrying in ${Math.round(delayMs / 1000)}s`,
          );
          if (!this.shuttingDown) {
            this.retryTimer = setTimeout(() => void this.rebuildWithRetry(), delayMs);
            this.retryTimer.unref?.();
          }
          return;
        }
      } while (this.pendingRebuild && !this.shuttingDown);
    } finally {
      this.rebuilding = false;
    }
  }

  private async rebuild(): Promise<void> {
    const docs = await this.documents.loadDocs();
    if (docs.length === 0) {
      throw new Error('team_documents is empty — waiting for the first registry sync');
    }

    this.retriever.setDocs(docs);
    this.ready = true;
    this.logger.log(`BM25 index rebuilt over ${docs.length} team docs`);

    await this.reembedAll(docs);
  }

  private async reembedAll(docs: Array<TeamDoc & { documentId: number }>): Promise<void> {
    const batchSize = 16;
    let written = 0;
    for (let start = 0; start < docs.length; start += batchSize) {
      const batch = docs.slice(start, start + batchSize);
      let vectors: number[][];
      try {
        vectors = await this.embeddings.embedDocuments(batch.map((d) => d.text));
      } catch (err) {
        this.logger.error(
          `embedding batch failed — vector retrieval degrades to BM25-only: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        return;
      }
      for (let i = 0; i < batch.length; i++) {
        const doc = batch[i];
        const vector = vectors[i];
        if (!doc || !vector) continue;
        if (vector.length !== EMBEDDING_DIMENSIONS) {
          this.logger.error(
            `embedding dimension mismatch: got ${vector.length}, column is vector(${EMBEDDING_DIMENSIONS}) — ` +
              `check EMBEDDING_MODEL; skipping embedding writes`,
          );
          return;
        }
        await this.documents.writeEmbedding(doc.documentId, vector);
        written += 1;
      }
    }
    this.logger.log(`re-embedded ${written}/${docs.length} team docs`);
  }
}
