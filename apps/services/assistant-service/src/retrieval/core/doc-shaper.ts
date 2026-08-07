import type { SeedFile } from '@orbit/shared';

/** One retrievable document = one team. */
export interface TeamDoc {
  /** queue key, e.g. "PAY-CHK" — the retrieval id everywhere. */
  key: string;
  name: string;
  /** Flattened text (what registry-service persists into team_documents.content). */
  text: string;
}

export interface FlattenTeamInput {
  name: string;
  queueKey: string;
  company: string;
  domain: string;
  tribe: string;
  description: string;
  apps: string[];
  keywords: string[];
  channel: string | null;
  lead: string | null;
  oncall: string | null;
}

/**
 * Canonical flattened text per team (brief §6): name, queue key,
 * company > domain > tribe, description, applications, keywords,
 * channel/lead/oncall. registry-service writes this into
 * team_documents.content; the eval builds the same shape from the seed file
 * so both rank over identical text.
 */
export function flattenTeamDoc(t: FlattenTeamInput): string {
  const contact = [
    t.channel ? `Channel: ${t.channel}` : '',
    t.lead ? `Team lead: ${t.lead}` : '',
    t.oncall ? `On-call: ${t.oncall}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return [
    `${t.name} (${t.queueKey})`,
    `${t.company} > ${t.domain} > ${t.tribe}`,
    t.description,
    t.apps.length > 0 ? `Applications: ${t.apps.join(', ')}` : '',
    t.keywords.length > 0 ? `Keywords: ${t.keywords.join(', ')}` : '',
    contact,
  ]
    .filter((line) => line.length > 0)
    .join('\n');
}

/**
 * The token stream BM25 indexes for a doc: the flattened content plus two
 * extra copies of the public name and queue key. Retrieval tuning note:
 * keywords/apps/description appear once and their distinctive terms carry the
 * ranking via IDF; name/key get a small term-frequency boost so "who owns
 * checkout"-style and literal "PAY-CHK" queries rank the right team first
 * without swamping keyword matches.
 */
export function bm25TextOf(doc: TeamDoc): string {
  const boost = `${doc.name} ${doc.key}`;
  return `${doc.text}\n${boost}\n${boost}`;
}

/** Build TeamDocs straight from the seed fixture (used by eval + tests — no DB). */
export function seedToTeamDocs(seed: SeedFile): TeamDoc[] {
  const docs: TeamDoc[] = [];
  for (const company of seed.companies) {
    const domainsBySlug = new Map(company.domains.map((d) => [d.slug, d]));
    const tribesBySlug = new Map(company.tribes.map((t) => [t.slug, t]));
    for (const team of company.teams) {
      const tribe = tribesBySlug.get(team.tribeSlug);
      const domain = tribe ? domainsBySlug.get(tribe.domainSlug) : undefined;
      docs.push({
        key: team.queueKey,
        name: team.name,
        text: flattenTeamDoc({
          name: team.name,
          queueKey: team.queueKey,
          company: company.name,
          domain: domain?.name ?? '',
          tribe: tribe?.name ?? '',
          description: team.description,
          apps: team.apps,
          keywords: team.keywords,
          channel: team.channel,
          lead: team.lead,
          oncall: team.oncall,
        }),
      });
    }
  }
  return docs;
}
