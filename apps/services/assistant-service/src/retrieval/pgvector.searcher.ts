import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { Embeddings } from '@langchain/core/embeddings';
import { EMBEDDINGS } from '../embeddings/embeddings.module';
import { DRIZZLE } from '../database/database.module';
import type { Db } from '../database/database.module';
import type { RankedResult } from './core/bm25';
import type { VectorSearcher } from './core/hybrid';

/**
 * Vector leg of hybrid retrieval: embed the query at request time, then
 * pgvector cosine distance (`<=>`) over team_documents.embedding (HNSW
 * indexed). Parameterized via drizzle `sql` — the vector goes over the wire
 * as a bound string literal, never interpolated.
 */
@Injectable()
export class PgVectorSearcher implements VectorSearcher {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    @Inject(EMBEDDINGS) private readonly embeddings: Embeddings,
  ) {}

  async search(query: string, limit: number): Promise<RankedResult[]> {
    const vector = await this.embeddings.embedQuery(query);
    const literal = `[${vector.join(',')}]`;
    const result = await this.db.execute(sql`
      SELECT t.queue_key AS key,
             1 - (d.embedding <=> ${literal}::vector) AS score
      FROM team_documents d
      JOIN teams t ON t.id = d.team_id
      WHERE d.embedding IS NOT NULL
      ORDER BY d.embedding <=> ${literal}::vector
      LIMIT ${limit}
    `);
    const rows = result.rows as Array<{ key: string; score: string | number }>;
    return rows.map((r) => ({ id: r.key, score: Number(r.score) }));
  }
}
