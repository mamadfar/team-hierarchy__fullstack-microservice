import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { teamDocuments, teams } from '@orbit/shared/db';
import { DRIZZLE } from '../database/database.module';
import type { Db } from '../database/database.module';
import type { TeamDoc } from './core/doc-shaper';

export interface StoredTeamDoc extends TeamDoc {
  documentId: number;
  hasEmbedding: boolean;
}

/**
 * Repository over team_documents: registry-service writes the flattened
 * content on every sync (it owns doc shaping + DDL); we read it joined to
 * teams for queueKey/name, and write back exactly one column — embedding.
 */
@Injectable()
export class DocumentBuilderService {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  async loadDocs(): Promise<StoredTeamDoc[]> {
    const rows = await this.db
      .select({
        documentId: teamDocuments.id,
        content: teamDocuments.content,
        embedding: teamDocuments.embedding,
        queueKey: teams.queueKey,
        name: teams.name,
      })
      .from(teamDocuments)
      .innerJoin(teams, eq(teams.id, teamDocuments.teamId));

    return rows.map((r) => ({
      documentId: r.documentId,
      key: r.queueKey,
      name: r.name,
      text: r.content,
      hasEmbedding: r.embedding !== null,
    }));
  }

  async writeEmbedding(documentId: number, embedding: number[]): Promise<void> {
    await this.db.update(teamDocuments).set({ embedding }).where(eq(teamDocuments.id, documentId));
  }
}
