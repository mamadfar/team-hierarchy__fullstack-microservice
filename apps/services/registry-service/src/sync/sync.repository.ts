import { Inject, Injectable } from '@nestjs/common';
import { count, eq, notInArray, sql } from 'drizzle-orm';

import {
  companies,
  domains,
  syncRuns,
  teamDocuments,
  teamLinks,
  teams,
  tribes,
} from '@orbit/shared/db';

import { AppError } from '../common/app-error';
import type { ApplyStats, ParsedRegistry } from '../common/ingest.types';
import type { Db } from '../database/database.module';
import { DRIZZLE } from '../database/database.tokens';
import { TeamDocumentBuilder } from './document-builder';

/**
 * Write side of the sync. applySnapshot runs the ENTIRE ingest in one drizzle
 * transaction: upserts companies/domains/tribes/teams, deletes rows that
 * disappeared, replaces team_links, rebuilds team_documents content (embedding
 * untouched — null for new rows) and recomputes teams.search_tsv in SQL.
 * Any failure rolls back and leaves the previous snapshot intact.
 */
@Injectable()
export class SyncRepository {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly documentBuilder: TeamDocumentBuilder,
  ) {}

  // ---- sync_runs bookkeeping (outside the ingest transaction on purpose:
  // a failed run must survive the rollback) ------------------------------

  async createRun(): Promise<number> {
    const rows = await this.db
      .insert(syncRuns)
      .values({ status: 'running' })
      .returning({ id: syncRuns.id });
    const id = rows[0]?.id;
    if (id === undefined) throw new AppError(500, 'Could not create sync_runs row');
    return id;
  }

  async completeRun(id: number, stats: Record<string, unknown>): Promise<Date> {
    const finishedAt = new Date();
    await this.db
      .update(syncRuns)
      .set({ status: 'success', finishedAt, stats, error: null })
      .where(eq(syncRuns.id, id));
    return finishedAt;
  }

  async failRun(id: number, error: string, stats: Record<string, unknown>): Promise<void> {
    await this.db
      .update(syncRuns)
      .set({ status: 'failed', finishedAt: new Date(), stats, error })
      .where(eq(syncRuns.id, id));
  }

  /** Boot-sync skip condition: a successful run exists AND teams is non-empty. */
  async hasSuccessfulRunWithData(): Promise<boolean> {
    const successRows = await this.db
      .select({ id: syncRuns.id })
      .from(syncRuns)
      .where(eq(syncRuns.status, 'success'))
      .limit(1);
    if (successRows.length === 0) return false;
    const teamCount = await this.db.select({ n: count() }).from(teams);
    return (teamCount[0]?.n ?? 0) > 0;
  }

  // ---- the one big transaction ------------------------------------------

  async applySnapshot(ingest: ParsedRegistry): Promise<ApplyStats> {
    return this.db.transaction(async (tx) => {
      const stats: ApplyStats = {
        companies: 0,
        domains: 0,
        tribes: 0,
        teams: 0,
        links: 0,
        linksSkipped: [],
        docsRebuilt: 0,
      };

      // -- companies
      const companySlugs: string[] = [];
      for (const { company } of ingest.companies) {
        companySlugs.push(company.slug);
        await tx
          .insert(companies)
          .values(company)
          .onConflictDoUpdate({
            target: companies.slug,
            set: {
              name: company.name,
              icon: company.icon,
              hue: company.hue,
              description: company.description,
              confluencePageId: company.confluencePageId,
              position: company.position,
            },
          });
        stats.companies += 1;
      }
      if (companySlugs.length > 0) {
        await tx.delete(companies).where(notInArray(companies.slug, companySlugs));
      } else {
        await tx.delete(companies);
      }

      const companyIdBySlug = new Map(
        (await tx.select({ id: companies.id, slug: companies.slug }).from(companies)).map((r) => [
          r.slug,
          r.id,
        ]),
      );

      // -- domains
      const domainSlugs: string[] = [];
      for (const parsedCompany of ingest.companies) {
        for (const domain of parsedCompany.domains) {
          const companyId = companyIdBySlug.get(parsedCompany.company.slug);
          if (companyId === undefined) {
            throw new AppError(500, `Sync: company "${parsedCompany.company.slug}" vanished mid-transaction`);
          }
          domainSlugs.push(domain.slug);
          const values = {
            slug: domain.slug,
            companyId,
            name: domain.name,
            hue: domain.hue,
            description: domain.description,
            position: domain.position,
          };
          await tx.insert(domains).values(values).onConflictDoUpdate({
            target: domains.slug,
            set: values,
          });
          stats.domains += 1;
        }
      }
      if (domainSlugs.length > 0) {
        await tx.delete(domains).where(notInArray(domains.slug, domainSlugs));
      } else {
        await tx.delete(domains);
      }

      const domainIdBySlug = new Map(
        (await tx.select({ id: domains.id, slug: domains.slug }).from(domains)).map((r) => [
          r.slug,
          r.id,
        ]),
      );

      // -- tribes
      const tribeSlugs: string[] = [];
      for (const parsedCompany of ingest.companies) {
        for (const tribe of parsedCompany.tribes) {
          const domainId = domainIdBySlug.get(tribe.domainSlug);
          if (domainId === undefined) {
            throw new AppError(
              422,
              `Sync: tribe "${tribe.name}" (${parsedCompany.company.name}) references unknown domain slug "${tribe.domainSlug}"`,
            );
          }
          tribeSlugs.push(tribe.slug);
          const values = { slug: tribe.slug, domainId, name: tribe.name, position: tribe.position };
          await tx.insert(tribes).values(values).onConflictDoUpdate({
            target: tribes.slug,
            set: values,
          });
          stats.tribes += 1;
        }
      }
      if (tribeSlugs.length > 0) {
        await tx.delete(tribes).where(notInArray(tribes.slug, tribeSlugs));
      } else {
        await tx.delete(tribes);
      }

      const tribeIdBySlug = new Map(
        (await tx.select({ id: tribes.id, slug: tribes.slug }).from(tribes)).map((r) => [
          r.slug,
          r.id,
        ]),
      );

      // -- teams
      const queueKeys: string[] = [];
      for (const parsedCompany of ingest.companies) {
        for (const team of parsedCompany.teams) {
          const tribeId = tribeIdBySlug.get(team.tribeSlug);
          if (tribeId === undefined) {
            throw new AppError(
              422,
              `Sync: team "${team.name}" (${team.queueKey}) references unknown tribe slug "${team.tribeSlug}"`,
            );
          }
          queueKeys.push(team.queueKey);
          const values = {
            queueKey: team.queueKey,
            name: team.name,
            tribeId,
            description: team.description,
            icon: team.icon,
            hue: team.hue,
            apps: team.apps,
            keywords: team.keywords,
            channel: team.channel,
            lead: team.lead,
            oncall: team.oncall,
            raw: team as unknown,
          };
          await tx.insert(teams).values(values).onConflictDoUpdate({
            target: teams.queueKey,
            set: values,
          });
          stats.teams += 1;
        }
      }
      if (queueKeys.length > 0) {
        await tx.delete(teams).where(notInArray(teams.queueKey, queueKeys));
      } else {
        await tx.delete(teams);
      }

      // -- team_links: replace wholesale; unknown keys / duplicate pairs are
      // skipped (recorded) instead of failing the whole registry.
      await tx.delete(teamLinks);
      const knownKeys = new Set(queueKeys);
      const seenPairs = new Set<string>();
      for (const link of ingest.links) {
        const pair = `${link.source}->${link.target}`;
        if (!knownKeys.has(link.source) || !knownKeys.has(link.target)) {
          stats.linksSkipped.push(`${pair}: unknown queue key`);
          continue;
        }
        if (seenPairs.has(pair)) {
          stats.linksSkipped.push(`${pair}: duplicate pair`);
          continue;
        }
        seenPairs.add(pair);
        await tx
          .insert(teamLinks)
          .values({ sourceKey: link.source, targetKey: link.target, reason: link.reason });
        stats.links += 1;
      }

      // -- team_documents: rebuild CONTENT only. Embedding column is never
      // touched here (null for new rows); unchanged content skips the update
      // entirely so existing embeddings stay valid.
      const teamIdByKey = new Map(
        (await tx.select({ id: teams.id, queueKey: teams.queueKey }).from(teams)).map((r) => [
          r.queueKey,
          r.id,
        ]),
      );
      for (const parsedCompany of ingest.companies) {
        const domainNameBySlug = new Map(parsedCompany.domains.map((d) => [d.slug, d.name]));
        const tribeBySlug = new Map(parsedCompany.tribes.map((t) => [t.slug, t]));
        for (const team of parsedCompany.teams) {
          const tribe = tribeBySlug.get(team.tribeSlug);
          const teamId = teamIdByKey.get(team.queueKey);
          if (!tribe || teamId === undefined) {
            throw new AppError(500, `Sync: lost track of team "${team.queueKey}" while rebuilding documents`);
          }
          const content = this.documentBuilder.build(team, {
            company: parsedCompany.company.name,
            domain: domainNameBySlug.get(tribe.domainSlug) ?? tribe.domainSlug,
            tribe: tribe.name,
          });
          const result = await tx
            .insert(teamDocuments)
            .values({ teamId, content })
            .onConflictDoUpdate({
              target: teamDocuments.teamId,
              set: { content, updatedAt: new Date() },
              setWhere: sql`${teamDocuments.content} is distinct from excluded.content`,
            });
          stats.docsRebuilt += result.rowCount ?? 0;
        }
      }

      // -- weighted full-text vector, computed in SQL inside the transaction
      await tx.execute(sql`
        UPDATE teams SET search_tsv =
          setweight(to_tsvector('simple', queue_key || ' ' || name), 'A') ||
          setweight(to_tsvector('simple', array_to_string(keywords, ' ') || ' ' || array_to_string(apps, ' ')), 'B') ||
          setweight(to_tsvector('simple', description), 'C')
      `);

      return stats;
    });
  }
}
