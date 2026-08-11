import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import type Redis from 'ioredis';
import type { Pool } from 'pg';

import { AppError } from '../common/app-error';
import { REGISTRY_SNAPSHOT_CACHE_KEY, SYNC_COMPLETED_CHANNEL } from '../common/constants';
import type { ParsedCompany, ParsedRegistry, SyncStats } from '../common/ingest.types';
import { confluencePageIds, ENV, Env } from '../config/env';
import { ConfluenceClient } from '../confluence/confluence.client';
import { ConfluencePageParser } from '../confluence/confluence-page.parser';
import { PG_POOL } from '../database/database.tokens';
import { REDIS } from '../redis/redis.module';
import { SeedSource } from './seed-source';
import { SyncRepository } from './sync.repository';

export type SyncTrigger = 'boot' | 'manual' | 'cron';

export interface SyncResult {
  runId: number;
  stats: SyncStats;
}

/** Session advisory lock key — distinct from Migrator's xact lock (492839021). */
const SYNC_ADVISORY_LOCK_KEY = 492839022;

/**
 * Orchestrates one full ingest: source (seed fixture when MOCK_CONFLUENCE,
 * otherwise the Confluence pages in CONFLUENCE_PAGE_IDS order) -> validation
 * (incl. the cross-page duplicate queue-key check) -> one transactional apply
 * -> sync_runs bookkeeping -> cache bust + "orbit:sync:completed" publish.
 * Idempotent: re-running against unchanged sources changes nothing.
 */
@Injectable()
export class SyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SyncService.name);
  private running = false;

  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly seedSource: SeedSource,
    private readonly confluenceClient: ConfluenceClient,
    private readonly parser: ConfluencePageParser,
    private readonly repository: SyncRepository,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  /** Boot policy: full sync on service start unless a successful run already
   * exists AND the teams table is non-empty. Boot failures are logged, not
   * fatal — the service keeps serving the previous snapshot. */
  async onApplicationBootstrap(): Promise<void> {
    try {
      if (await this.repository.hasSuccessfulRunWithData()) {
        this.logger.log('Boot sync skipped: previous successful sync with data exists');
        return;
      }
      await this.run('boot');
    } catch (error) {
      this.logger.error(
        `Boot sync failed (service continues with existing data): ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  async run(trigger: SyncTrigger): Promise<SyncResult> {
    if (this.running) {
      throw new AppError(409, 'A sync is already running');
    }
    this.running = true;

    const lockClient = await this.pool.connect();
    try {
      const locked = await lockClient.query<{ ok: boolean }>(
        'SELECT pg_try_advisory_lock($1) AS ok',
        [SYNC_ADVISORY_LOCK_KEY],
      );
      if (!locked.rows[0]?.ok) {
        throw new AppError(409, 'A sync is already running');
      }

      return await this.runLocked(trigger);
    } finally {
      await lockClient
        .query('SELECT pg_advisory_unlock($1)', [SYNC_ADVISORY_LOCK_KEY])
        .catch(() => undefined);
      lockClient.release();
      this.running = false;
    }
  }

  private async runLocked(trigger: SyncTrigger): Promise<SyncResult> {
    const stats: SyncStats = {
      trigger,
      pages: 0,
      companies: 0,
      domains: 0,
      tribes: 0,
      teams: 0,
      links: 0,
      docsRebuilt: 0,
      rowErrors: [],
    };
    const runId = await this.repository.createRun();

    try {
      const ingest = this.env.MOCK_CONFLUENCE
        ? this.seedSource.load()
        : await this.loadFromConfluence();
      stats.pages = ingest.pages;

      this.assertUniqueCompanySlugs(ingest.companies);
      this.assertUniqueQueueKeys(ingest.companies);

      const applied = await this.repository.applySnapshot(ingest);
      stats.companies = applied.companies;
      stats.domains = applied.domains;
      stats.tribes = applied.tribes;
      stats.teams = applied.teams;
      stats.links = applied.links;
      stats.docsRebuilt = applied.docsRebuilt;
      if (applied.linksSkipped.length > 0) {
        stats.rowErrors.push(...applied.linksSkipped.map((s) => `link skipped: ${s}`));
      }

      const finishedAt = await this.repository.completeRun(runId, stats);
      await this.afterSuccess(runId, finishedAt);
      this.logger.log(
        `Sync #${runId} (${trigger}) ok: ${stats.teams} teams / ${stats.companies} companies / ${stats.links} links`,
      );
      return { runId, stats };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof AppError && Array.isArray(error.details)) {
        stats.rowErrors.push(...error.details.map(String));
      }
      await this.repository
        .failRun(runId, message, stats)
        .catch((e: unknown) =>
          this.logger.error(`Could not record failed sync run: ${e instanceof Error ? e.message : e}`),
        );
      this.logger.error(`Sync #${runId} (${trigger}) failed: ${message}`);
      throw error instanceof AppError ? error : new AppError(500, `Sync failed: ${message}`);
    }
  }

  // ---- sources ----------------------------------------------------------

  private async loadFromConfluence(): Promise<ParsedRegistry> {
    const pageIds = confluencePageIds(this.env);
    if (pageIds.length === 0) {
      throw new AppError(
        500,
        'CONFLUENCE_PAGE_IDS is empty — nothing to sync. Set CONFLUENCE_PAGE_IDS in .env to comma-separated page ids from each company page URL (.../pages/<id>/...), and set MOCK_CONFLUENCE=false when using live Confluence.',
      );
    }
    const parsedCompanies: ParsedCompany[] = [];
    const links: ParsedRegistry['links'] = [];
    for (const [position, pageId] of pageIds.entries()) {
      const page = await this.confluenceClient.getPageStorage(pageId);
      const parsed = this.parser.parsePage(page.html, { pageId, position });
      parsedCompanies.push({
        company: parsed.company,
        domains: parsed.domains,
        tribes: parsed.tribes,
        teams: parsed.teams,
      });
      links.push(...parsed.links);
    }
    return { pages: pageIds.length, companies: parsedCompanies, links };
  }

  // ---- validation across pages ------------------------------------------

  /** Queue Key must be unique across ALL companies; the error names both offending rows. */
  private assertUniqueQueueKeys(parsedCompanies: ParsedCompany[]): void {
    const seen = new Map<string, { company: string; team: string }>();
    for (const parsedCompany of parsedCompanies) {
      for (const team of parsedCompany.teams) {
        const previous = seen.get(team.queueKey);
        if (previous) {
          throw new AppError(
            422,
            `Duplicate queue key "${team.queueKey}": "${previous.team}" (${previous.company}) and "${team.name}" (${parsedCompany.company.name}) — sync aborted`,
          );
        }
        seen.set(team.queueKey, { company: parsedCompany.company.name, team: team.name });
      }
    }
  }

  private assertUniqueCompanySlugs(parsedCompanies: ParsedCompany[]): void {
    const seen = new Map<string, string>();
    for (const { company } of parsedCompanies) {
      const previous = seen.get(company.slug);
      if (previous !== undefined) {
        throw new AppError(
          422,
          `Two company pages resolve to the same slug "${company.slug}" (pages ${previous} and ${company.confluencePageId}) — rename one company`,
        );
      }
      seen.set(company.slug, company.confluencePageId);
    }
  }

  // ---- post-success side effects -----------------------------------------

  private async afterSuccess(runId: number, finishedAt: Date): Promise<void> {
    try {
      await this.redis.del(REGISTRY_SNAPSHOT_CACHE_KEY);
      await this.redis.publish(
        SYNC_COMPLETED_CHANNEL,
        JSON.stringify({ runId, finishedAt: finishedAt.toISOString() }),
      );
    } catch (error) {
      // The sync itself succeeded; a cache/publish hiccup must not fail it.
      this.logger.error(
        `Post-sync cache bust/publish failed: ${error instanceof Error ? error.message : error}`,
      );
    }
  }
}
