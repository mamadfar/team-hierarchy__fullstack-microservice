import { Injectable } from '@nestjs/common';
import { load, type CheerioAPI } from 'cheerio';
import type { AnyNode } from 'domhandler';

import {
  CompanySchema,
  DomainSchema,
  normalizeIconName,
  QueueKeySchema,
  TeamSchema,
  TribeSchema,
  type Domain,
  type Team,
  type TeamLink,
  type Tribe,
} from '@orbit/shared';

import { AppError } from '../common/app-error';
import type { ParsedCompany } from '../common/ingest.types';
import { slugify } from '../common/slugify';

/** Hues assigned to domains/companies that carry no explicit Color (order of first appearance). */
const HUE_PALETTE = [215, 346, 262, 152, 32, 200, 290, 90, 120, 180] as const;

const CompanyBaseSchema = CompanySchema.omit({ teamCount: true });

export interface ParsedPage extends ParsedCompany {
  links: TeamLink[];
}

interface RawTable {
  /** All rows (including any header row) as trimmed plain-text cells. */
  rows: string[][];
}

type TableKind = 'teams' | 'links' | 'domains' | 'config' | 'unknown';

type TeamField =
  | 'name'
  | 'queueKey'
  | 'tribe'
  | 'domain'
  | 'description'
  | 'apps'
  | 'keywords'
  | 'icon'
  | 'hue'
  | 'channel'
  | 'lead'
  | 'oncall';

/** Headers matched case-insensitively BY NAME (not position) so columns can be reordered. */
const TEAM_HEADER_ALIASES: Record<string, TeamField> = {
  'team name': 'name',
  team: 'name',
  name: 'name',
  'queue key': 'queueKey',
  queue: 'queueKey',
  key: 'queueKey',
  tribe: 'tribe',
  domain: 'domain',
  description: 'description',
  applications: 'apps',
  apps: 'apps',
  keywords: 'keywords',
  icon: 'icon',
  color: 'hue',
  colour: 'hue',
  channel: 'channel',
  'slack channel': 'channel',
  'team lead': 'lead',
  lead: 'lead',
  'on-call': 'oncall',
  oncall: 'oncall',
  'on call': 'oncall',
};

const REQUIRED_TEAM_FIELDS: readonly TeamField[] = ['name', 'queueKey', 'tribe', 'domain'];

/**
 * Parses one Confluence company page (storage-format XHTML) per
 * docs/CONFLUENCE_SETUP.md:
 *  - company config table (Key/Value rows: Name, Icon, Color, Description)
 *  - teams table (headers matched by name)
 *  - optional Domains table (Name | Color | Description)
 *  - optional Links table (Source Key | Target Key | Reason)
 * Confluence macros/status/emoji elements are stripped to plain text.
 * Missing config or teams table -> loud error; the registry is never
 * silently emptied.
 */
@Injectable()
export class ConfluencePageParser {
  parsePage(html: string, ctx: { pageId: string; position: number }): ParsedPage {
    const $ = load(this.preprocessEntities(html), { xml: true });
    const tables = this.extractTables($);

    const configTable = tables.find((t) => this.classify(t) === 'config');
    const teamsTable = tables.find((t) => this.classify(t) === 'teams');
    const domainsTable = tables.find((t) => this.classify(t) === 'domains');
    const linksTable = tables.find((t) => this.classify(t) === 'links');

    if (!configTable) {
      throw new AppError(
        422,
        `Confluence page ${ctx.pageId}: company config table (Key/Value with a "Name" row) not found — refusing to sync`,
      );
    }
    const config = this.parseConfigTable(configTable);
    const companyName = config.get('name')?.trim() ?? '';
    if (!companyName) {
      throw new AppError(422, `Confluence page ${ctx.pageId}: company config table has no "Name" value`);
    }
    if (!teamsTable) {
      throw new AppError(
        422,
        `Confluence page ${ctx.pageId} ("${companyName}"): teams table (with "Team Name" and "Queue Key" columns) not found — refusing to sync`,
      );
    }

    const companySlug = slugify(companyName);
    const company = CompanyBaseSchema.parse({
      slug: companySlug,
      name: companyName,
      icon: normalizeIconName(config.get('icon')),
      hue:
        this.parseHue(config.get('color') ?? config.get('colour'), `company "${companyName}" config`) ??
        HUE_PALETTE[ctx.position % HUE_PALETTE.length],
      description: config.get('description')?.trim() ?? '',
      confluencePageId: ctx.pageId,
      position: ctx.position,
    });

    const { teams: rawTeams, errors } = this.parseTeamRows(teamsTable, companyName);
    const domainMeta = domainsTable ? this.parseDomainsTable(domainsTable, companyName) : new Map();
    const links = linksTable ? this.parseLinksTable(linksTable, companyName, errors) : [];

    if (errors.length > 0) {
      throw new AppError(
        422,
        `Confluence page ${ctx.pageId} ("${companyName}"): ${errors.length} invalid row(s): ${errors.join(' | ')}`,
        errors,
      );
    }

    const { domains, tribes, teams } = this.assemble(companySlug, companyName, rawTeams, domainMeta);
    return { company, domains, tribes, teams, links };
  }

  // ---- table extraction ------------------------------------------------

  /** Common HTML entities Confluence emits that strict XML parsing would not decode. */
  private preprocessEntities(html: string): string {
    return html
      .replace(/&nbsp;/g, ' ')
      .replace(/&ndash;/g, '–')
      .replace(/&mdash;/g, '—')
      .replace(/&lsquo;/g, '‘')
      .replace(/&rsquo;/g, '’')
      .replace(/&ldquo;/g, '“')
      .replace(/&rdquo;/g, '”')
      .replace(/&hellip;/g, '…');
  }

  private extractTables($: CheerioAPI): RawTable[] {
    const tables: RawTable[] = [];
    $('table').each((_, tableEl) => {
      const rows: string[][] = [];
      $(tableEl)
        .find('tr')
        .each((__, tr) => {
          const cells = $(tr)
            .children('th,td')
            .toArray()
            .map((cell) => this.cellText($, cell));
          if (cells.length > 0 && cells.some((c) => c !== '')) rows.push(cells);
        });
      if (rows.length > 0) tables.push({ rows });
    });
    return tables;
  }

  /**
   * Cell -> plain text: namespaced Confluence elements (ac:*, ri:* — macros,
   * status lozenges, emoticons) are removed entirely; block boundaries and
   * <br/> become spaces; whitespace is collapsed.
   */
  private cellText($: CheerioAPI, cell: AnyNode): string {
    const clone = $(cell).clone();
    clone.find('*').each((_, el) => {
      const name = (el as { name?: string }).name ?? '';
      if (name.includes(':')) {
        $(el).remove();
        return;
      }
      if (name === 'br') {
        $(el).replaceWith(' ');
        return;
      }
      if (['p', 'div', 'li', 'ul', 'ol', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(name)) {
        $(el).append(' ');
      }
    });
    return clone.text().replace(/\s+/g, ' ').trim();
  }

  private classify(table: RawTable): TableKind {
    const first = (table.rows[0] ?? []).map((c) => c.toLowerCase());
    if (first.includes('team name') && first.includes('queue key')) return 'teams';
    if (first.includes('source key') && first.includes('target key')) return 'links';

    const width = Math.max(...table.rows.map((r) => r.length));
    if (width === 2) {
      const keys = table.rows.map((r) => (r[0] ?? '').toLowerCase());
      const known = ['name', 'icon', 'color', 'colour', 'description'];
      if ((first[0] === 'key' && first[1] === 'value') || keys.some((k) => known.includes(k))) {
        return 'config';
      }
    }
    if (first.includes('name') && (first.includes('color') || first.includes('colour'))) {
      return 'domains';
    }
    return 'unknown';
  }

  // ---- individual tables -----------------------------------------------

  private parseConfigTable(table: RawTable): Map<string, string> {
    const first = (table.rows[0] ?? []).map((c) => c.toLowerCase());
    const dataRows = first[0] === 'key' && first[1] === 'value' ? table.rows.slice(1) : table.rows;
    const map = new Map<string, string>();
    for (const row of dataRows) {
      const key = (row[0] ?? '').trim().toLowerCase();
      if (key) map.set(key, (row[1] ?? '').trim());
    }
    return map;
  }

  private parseTeamRows(
    table: RawTable,
    companyName: string,
  ): { teams: RawTeamRow[]; errors: string[] } {
    const headers = (table.rows[0] ?? []).map((h) => h.toLowerCase().trim());
    const columnOf = new Map<TeamField, number>();
    headers.forEach((header, index) => {
      const field = TEAM_HEADER_ALIASES[header];
      if (field !== undefined && !columnOf.has(field)) columnOf.set(field, index);
    });

    const missing = REQUIRED_TEAM_FIELDS.filter((f) => !columnOf.has(f));
    if (missing.length > 0) {
      throw new AppError(
        422,
        `Teams table for "${companyName}" is missing required column(s): ${missing.join(', ')}`,
      );
    }

    const cell = (row: string[], field: TeamField): string => {
      const index = columnOf.get(field);
      return index === undefined ? '' : (row[index] ?? '').trim();
    };

    const errors: string[] = [];
    const teams: RawTeamRow[] = [];
    const seenKeys = new Map<string, string>();

    table.rows.slice(1).forEach((row, i) => {
      const rowNo = i + 1;
      const name = cell(row, 'name');
      const rawKey = cell(row, 'queueKey').toUpperCase();
      const label = `${companyName} row ${rowNo} ("${name || rawKey || '?'}")`;

      const rowErrors: string[] = [];
      if (!name) rowErrors.push(`${label}: missing Team Name`);
      if (!rawKey) rowErrors.push(`${label}: missing Queue Key`);
      const tribe = cell(row, 'tribe');
      const domain = cell(row, 'domain');
      if (!tribe) rowErrors.push(`${label}: missing Tribe`);
      if (!domain) rowErrors.push(`${label}: missing Domain`);

      if (rawKey && !QueueKeySchema.safeParse(rawKey).success) {
        rowErrors.push(`${label}: invalid Queue Key "${rawKey}" (expected e.g. "PAY-CHK")`);
      }

      let hue: number | null = null;
      try {
        hue = this.parseHue(cell(row, 'hue'), label);
      } catch (error) {
        rowErrors.push(error instanceof Error ? error.message : String(error));
      }

      if (rawKey && rowErrors.length === 0) {
        const previous = seenKeys.get(rawKey);
        if (previous !== undefined) {
          rowErrors.push(
            `Duplicate queue key "${rawKey}": "${previous}" (${companyName}) and "${name}" (${companyName})`,
          );
        } else {
          seenKeys.set(rawKey, name);
        }
      }

      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
        return;
      }

      teams.push({
        name,
        queueKey: rawKey,
        tribe,
        domain,
        description: cell(row, 'description'),
        apps: this.splitList(cell(row, 'apps')),
        keywords: this.splitList(cell(row, 'keywords')),
        icon: normalizeIconName(cell(row, 'icon')),
        hue,
        channel: cell(row, 'channel') || null,
        lead: cell(row, 'lead') || null,
        oncall: cell(row, 'oncall') || null,
      });
    });

    return { teams, errors };
  }

  private parseDomainsTable(
    table: RawTable,
    companyName: string,
  ): Map<string, { hue: number | null; description: string }> {
    const headers = (table.rows[0] ?? []).map((h) => h.toLowerCase().trim());
    const nameIdx = headers.findIndex((h) => h === 'name' || h === 'domain');
    const hueIdx = headers.findIndex((h) => h === 'color' || h === 'colour');
    const descIdx = headers.findIndex((h) => h === 'description');
    const meta = new Map<string, { hue: number | null; description: string }>();
    if (nameIdx < 0) return meta;

    for (const row of table.rows.slice(1)) {
      const name = (row[nameIdx] ?? '').trim();
      if (!name) continue;
      meta.set(name.toLowerCase(), {
        hue: this.parseHue(hueIdx >= 0 ? row[hueIdx] : undefined, `${companyName} domain "${name}"`),
        description: descIdx >= 0 ? (row[descIdx] ?? '').trim() : '',
      });
    }
    return meta;
  }

  private parseLinksTable(table: RawTable, companyName: string, errors: string[]): TeamLink[] {
    const headers = (table.rows[0] ?? []).map((h) => h.toLowerCase().trim());
    const sourceIdx = headers.findIndex((h) => h === 'source key' || h === 'source');
    const targetIdx = headers.findIndex((h) => h === 'target key' || h === 'target');
    const reasonIdx = headers.findIndex((h) => h === 'reason');

    const links: TeamLink[] = [];
    table.rows.slice(1).forEach((row, i) => {
      const source = (row[sourceIdx] ?? '').trim().toUpperCase();
      const target = (row[targetIdx] ?? '').trim().toUpperCase();
      const reason = reasonIdx >= 0 ? (row[reasonIdx] ?? '').trim() : '';
      const label = `${companyName} links row ${i + 1}`;
      if (!source || !target) {
        errors.push(`${label}: missing Source Key or Target Key`);
        return;
      }
      if (!QueueKeySchema.safeParse(source).success || !QueueKeySchema.safeParse(target).success) {
        errors.push(`${label}: invalid queue key "${source}" -> "${target}"`);
        return;
      }
      links.push({ source, target, reason });
    });
    return links;
  }

  // ---- assembly ---------------------------------------------------------

  /**
   * Domains derive from grouping team rows' Domain column (order of first
   * appearance), merged with the optional Domains table; tribes derive from
   * (Domain, Tribe) pairs in row order. Slugs are prefixed with the company
   * (and domain) slug so they stay unique across companies.
   */
  private assemble(
    companySlug: string,
    companyName: string,
    rows: RawTeamRow[],
    domainMeta: Map<string, { hue: number | null; description: string }>,
  ): { domains: Domain[]; tribes: Tribe[]; teams: Team[] } {
    const domainOrder: string[] = [];
    const tribeOrder: Array<{ domain: string; tribe: string }> = [];

    for (const row of rows) {
      if (!domainOrder.some((d) => d.toLowerCase() === row.domain.toLowerCase())) {
        domainOrder.push(row.domain);
      }
      if (
        !tribeOrder.some(
          (t) =>
            t.domain.toLowerCase() === row.domain.toLowerCase() &&
            t.tribe.toLowerCase() === row.tribe.toLowerCase(),
        )
      ) {
        tribeOrder.push({ domain: row.domain, tribe: row.tribe });
      }
    }

    const domainSlugByName = new Map<string, string>();
    const domains: Domain[] = domainOrder.map((name, position) => {
      const slug = `${companySlug}-${slugify(name)}`;
      domainSlugByName.set(name.toLowerCase(), slug);
      const meta = domainMeta.get(name.toLowerCase());
      return DomainSchema.parse({
        slug,
        companySlug,
        name,
        hue: meta?.hue ?? HUE_PALETTE[position % HUE_PALETTE.length],
        description: meta?.description ?? '',
        position,
      });
    });

    const tribeSlugByPair = new Map<string, string>();
    const tribes: Tribe[] = tribeOrder.map(({ domain, tribe }, position) => {
      const domainSlug = domainSlugByName.get(domain.toLowerCase()) as string;
      const slug = `${domainSlug}-${slugify(tribe)}`;
      tribeSlugByPair.set(`${domain.toLowerCase()}::${tribe.toLowerCase()}`, slug);
      return TribeSchema.parse({ slug, domainSlug, name: tribe, position });
    });

    const teams: Team[] = rows.map((row) => {
      const tribeSlug = tribeSlugByPair.get(
        `${row.domain.toLowerCase()}::${row.tribe.toLowerCase()}`,
      ) as string;
      const candidate = {
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
      };
      const parsed = TeamSchema.safeParse(candidate);
      if (!parsed.success) {
        throw new AppError(
          422,
          `${companyName} team "${row.name}" (${row.queueKey}) failed validation: ${parsed.error.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join('; ')}`,
        );
      }
      return parsed.data;
    });

    return { domains, tribes, teams };
  }

  // ---- helpers ----------------------------------------------------------

  /** "" -> null; otherwise an integer 0–360 or a loud AppError. */
  private parseHue(value: string | undefined, context: string): number | null {
    const v = (value ?? '').trim();
    if (!v) return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0 || n > 360) {
      throw new AppError(422, `${context}: invalid hue "${v}" — expected an integer 0–360`);
    }
    return n;
  }

  private splitList(value: string): string[] {
    return value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
}

interface RawTeamRow {
  name: string;
  queueKey: string;
  tribe: string;
  domain: string;
  description: string;
  apps: string[];
  keywords: string[];
  icon: string;
  hue: number | null;
  channel: string | null;
  lead: string | null;
  oncall: string | null;
}
