import { Inject, Injectable } from '@nestjs/common';
import { asc, desc, eq, sql } from 'drizzle-orm';

import { companies, domains, syncRuns, teamLinks, teams, tribes } from '@orbit/shared/db';

import type { Db } from '../database/database.module';
import { DRIZZLE } from '../database/database.tokens';

export type CompanyRow = typeof companies.$inferSelect;
export type DomainRow = typeof domains.$inferSelect;
export type TribeRow = typeof tribes.$inferSelect;
export type TeamRow = typeof teams.$inferSelect;
export type TeamLinkRow = typeof teamLinks.$inferSelect;
export type SyncRunRow = typeof syncRuns.$inferSelect;

/** Read side of the registry: plain drizzle selects, no business logic. */
@Injectable()
export class RegistryRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  findCompanies(): Promise<CompanyRow[]> {
    return this.db.select().from(companies).orderBy(asc(companies.position), asc(companies.id));
  }

  findDomains(): Promise<Array<{ domain: DomainRow; companySlug: string }>> {
    return this.db
      .select({ domain: domains, companySlug: companies.slug })
      .from(domains)
      .innerJoin(companies, eq(domains.companyId, companies.id))
      .orderBy(asc(companies.position), asc(domains.position), asc(domains.id));
  }

  findTribes(): Promise<Array<{ tribe: TribeRow; domainSlug: string }>> {
    return this.db
      .select({ tribe: tribes, domainSlug: domains.slug })
      .from(tribes)
      .innerJoin(domains, eq(tribes.domainId, domains.id))
      .innerJoin(companies, eq(domains.companyId, companies.id))
      .orderBy(asc(companies.position), asc(tribes.position), asc(tribes.id));
  }

  findTeams(): Promise<Array<{ team: TeamRow; tribeSlug: string; companySlug: string }>> {
    return this.db
      .select({ team: teams, tribeSlug: tribes.slug, companySlug: companies.slug })
      .from(teams)
      .innerJoin(tribes, eq(teams.tribeId, tribes.id))
      .innerJoin(domains, eq(tribes.domainId, domains.id))
      .innerJoin(companies, eq(domains.companyId, companies.id))
      .orderBy(asc(companies.position), asc(teams.id));
  }

  findLinks(): Promise<TeamLinkRow[]> {
    return this.db.select().from(teamLinks).orderBy(asc(teamLinks.id));
  }

  async findTeamByQueueKey(
    queueKey: string,
  ): Promise<{ team: TeamRow; tribeSlug: string } | null> {
    const rows = await this.db
      .select({ team: teams, tribeSlug: tribes.slug })
      .from(teams)
      .innerJoin(tribes, eq(teams.tribeId, tribes.id))
      .where(eq(teams.queueKey, queueKey))
      .limit(1);
    return rows[0] ?? null;
  }

  async findLastSuccessfulSync(): Promise<Date | null> {
    const rows = await this.db
      .select({ finishedAt: syncRuns.finishedAt })
      .from(syncRuns)
      .where(eq(syncRuns.status, 'success'))
      .orderBy(desc(syncRuns.finishedAt))
      .limit(1);
    return rows[0]?.finishedAt ?? null;
  }

  findRecentSyncRuns(limit = 10): Promise<SyncRunRow[]> {
    return this.db
      .select()
      .from(syncRuns)
      .orderBy(desc(syncRuns.startedAt), desc(syncRuns.id))
      .limit(limit);
  }

  async pingDb(): Promise<void> {
    await this.db.execute(sql`select 1`);
  }
}
