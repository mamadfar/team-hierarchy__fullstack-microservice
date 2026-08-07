import type { Company, Domain, Team, TeamLink, Tribe } from '@orbit/shared';

/** One company page after parsing/validation (Confluence page or seed entry). */
export interface ParsedCompany {
  company: Omit<Company, 'teamCount'>;
  domains: Domain[];
  tribes: Tribe[];
  teams: Team[];
}

/** Everything one sync run ingests, already validated with the shared zod schemas. */
export interface ParsedRegistry {
  pages: number;
  companies: ParsedCompany[];
  links: TeamLink[];
}

/** Result of applying a ParsedRegistry to the database (one transaction). */
export interface ApplyStats {
  companies: number;
  domains: number;
  tribes: number;
  teams: number;
  links: number;
  linksSkipped: string[];
  docsRebuilt: number;
}

export interface SyncStats extends Record<string, unknown> {
  trigger: 'boot' | 'manual' | 'cron';
  pages: number;
  companies: number;
  domains: number;
  tribes: number;
  teams: number;
  links: number;
  docsRebuilt: number;
  /** Row-level validation errors (also the reason the run failed, when present). */
  rowErrors: string[];
}
