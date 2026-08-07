import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';

import {
  RegistrySnapshotSchema,
  SyncRunSchema,
  TeamSchema,
  type RegistrySnapshot,
  type SyncRun,
  type Team,
} from '@orbit/shared';

import { AppError } from '../common/app-error';
import { REGISTRY_SNAPSHOT_CACHE_KEY } from '../common/constants';
import { ENV, Env } from '../config/env';
import { REDIS } from '../redis/redis.module';
import { RegistryRepository, type SyncRunRow, type TeamRow } from './registry.repository';

export interface HealthStatus {
  status: 'ok';
  db: 'up';
  redis: 'up' | 'down';
}

/**
 * Assembles the RegistrySnapshot exactly per RegistrySnapshotSchema and caches
 * it in Redis under "orbit:registry:snapshot" (busted by SyncService after
 * every successful sync). Redis being down degrades to direct DB reads.
 */
@Injectable()
export class RegistryService {
  private readonly logger = new Logger(RegistryService.name);

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly repository: RegistryRepository,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async getSnapshot(): Promise<RegistrySnapshot> {
    const cached = await this.readCache();
    if (cached) return cached;

    const snapshot = await this.assembleSnapshot();
    await this.writeCache(snapshot);
    return snapshot;
  }

  async getTeamByQueueKey(queueKey: string): Promise<Team> {
    const row = await this.repository.findTeamByQueueKey(queueKey);
    if (!row) {
      throw new AppError(404, `Unknown team queue key "${queueKey}"`);
    }
    return this.toTeam(row.team, row.tribeSlug);
  }

  async getSyncRuns(): Promise<SyncRun[]> {
    const rows = await this.repository.findRecentSyncRuns(10);
    return rows.map((row) => this.toSyncRun(row));
  }

  async getHealth(): Promise<HealthStatus> {
    try {
      await this.repository.pingDb();
    } catch {
      throw new AppError(503, 'Database unavailable');
    }
    let redis: 'up' | 'down' = 'up';
    try {
      await this.redis.ping();
    } catch {
      redis = 'down';
    }
    return { status: 'ok', db: 'up', redis };
  }

  // ---- assembly ---------------------------------------------------------

  private async assembleSnapshot(): Promise<RegistrySnapshot> {
    const [companyRows, domainRows, tribeRows, teamRows, linkRows, lastSync] = await Promise.all([
      this.repository.findCompanies(),
      this.repository.findDomains(),
      this.repository.findTribes(),
      this.repository.findTeams(),
      this.repository.findLinks(),
      this.repository.findLastSuccessfulSync(),
    ]);

    const teamCountByCompany = new Map<string, number>();
    for (const { companySlug } of teamRows) {
      teamCountByCompany.set(companySlug, (teamCountByCompany.get(companySlug) ?? 0) + 1);
    }

    const snapshot: RegistrySnapshot = {
      group: {
        name: this.env.GROUP_NAME,
        icon: this.env.GROUP_ICON,
        hue: this.env.GROUP_HUE,
      },
      companies: companyRows.map((c) => ({
        slug: c.slug,
        name: c.name,
        icon: c.icon,
        hue: c.hue,
        description: c.description,
        confluencePageId: c.confluencePageId,
        position: c.position,
        teamCount: teamCountByCompany.get(c.slug) ?? 0,
      })),
      domains: domainRows.map(({ domain, companySlug }) => ({
        slug: domain.slug,
        companySlug,
        name: domain.name,
        hue: domain.hue,
        description: domain.description,
        position: domain.position,
      })),
      tribes: tribeRows.map(({ tribe, domainSlug }) => ({
        slug: tribe.slug,
        domainSlug,
        name: tribe.name,
        position: tribe.position,
      })),
      teams: teamRows.map(({ team, tribeSlug }) => this.toTeam(team, tribeSlug)),
      links: linkRows.map((link) => ({
        source: link.sourceKey,
        target: link.targetKey,
        reason: link.reason,
      })),
      lastSync: lastSync ? lastSync.toISOString() : null,
    };

    // Contract guarantee: never serve a snapshot that violates the shared schema.
    return RegistrySnapshotSchema.parse(snapshot);
  }

  private toTeam(row: TeamRow, tribeSlug: string): Team {
    return TeamSchema.parse({
      queueKey: row.queueKey,
      name: row.name,
      tribeSlug,
      description: row.description,
      icon: row.icon,
      hue: row.hue,
      apps: row.apps,
      keywords: row.keywords,
      channel: row.channel,
      lead: row.lead,
      oncall: row.oncall,
    });
  }

  private toSyncRun(row: SyncRunRow): SyncRun {
    return SyncRunSchema.parse({
      id: row.id,
      startedAt: row.startedAt.toISOString(),
      finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
      status: row.status,
      stats: (row.stats ?? null) as Record<string, unknown> | null,
      error: row.error,
    });
  }

  // ---- cache ------------------------------------------------------------

  private async readCache(): Promise<RegistrySnapshot | null> {
    try {
      const raw = await this.redis.get(REGISTRY_SNAPSHOT_CACHE_KEY);
      if (!raw) return null;
      return RegistrySnapshotSchema.parse(JSON.parse(raw));
    } catch (error) {
      this.logger.warn(
        `Snapshot cache read failed, falling back to DB: ${error instanceof Error ? error.message : error}`,
      );
      return null;
    }
  }

  private async writeCache(snapshot: RegistrySnapshot): Promise<void> {
    try {
      // 1h TTL is a safety net only — SyncService busts this key after each sync.
      await this.redis.set(REGISTRY_SNAPSHOT_CACHE_KEY, JSON.stringify(snapshot), 'EX', 3600);
    } catch (error) {
      this.logger.warn(
        `Snapshot cache write failed: ${error instanceof Error ? error.message : error}`,
      );
    }
  }
}
