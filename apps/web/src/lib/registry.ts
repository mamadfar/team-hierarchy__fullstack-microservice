import type { Company, Domain, RegistrySnapshot, Team, Tribe } from '@orbit/shared';

/**
 * Lookup index over a RegistrySnapshot. All canvas layouts, the sidebar tree,
 * search and the detail panel derive from this one structure.
 */
export interface RegistryIndex {
  teams: Map<string, Team>;
  tribes: Map<string, Tribe>;
  domains: Map<string, Domain>;
  companies: Map<string, Company>;
  /** Teams grouped by tribe slug, in snapshot order. */
  teamsByTribe: Map<string, Team[]>;
  tribeOf(team: Team): Tribe;
  domainOf(team: Team): Domain;
  companyOf(team: Team): Company;
  /** Team hue with the domain-hue fallback (hue == null → domain hue). */
  hueOf(team: Team): number;
  /** "Company · Domain · Tribe" breadcrumb. */
  pathOf(team: Team): string;
}

export function buildIndex(snapshot: RegistrySnapshot): RegistryIndex {
  const teams = new Map(snapshot.teams.map((t) => [t.queueKey, t]));
  const tribes = new Map(snapshot.tribes.map((t) => [t.slug, t]));
  const domains = new Map(snapshot.domains.map((d) => [d.slug, d]));
  const companies = new Map(snapshot.companies.map((c) => [c.slug, c]));

  const teamsByTribe = new Map<string, Team[]>();
  for (const team of snapshot.teams) {
    const list = teamsByTribe.get(team.tribeSlug);
    if (list) list.push(team);
    else teamsByTribe.set(team.tribeSlug, [team]);
  }

  const mustGet = <T>(map: Map<string, T>, key: string, kind: string): T => {
    const value = map.get(key);
    if (!value) throw new Error(`Registry snapshot is inconsistent: missing ${kind} "${key}"`);
    return value;
  };

  const tribeOf = (team: Team): Tribe => mustGet(tribes, team.tribeSlug, 'tribe');
  const domainOf = (team: Team): Domain => mustGet(domains, tribeOf(team).domainSlug, 'domain');
  const companyOf = (team: Team): Company =>
    mustGet(companies, domainOf(team).companySlug, 'company');

  return {
    teams,
    tribes,
    domains,
    companies,
    teamsByTribe,
    tribeOf,
    domainOf,
    companyOf,
    hueOf: (team) => (team.hue != null ? team.hue : domainOf(team).hue),
    pathOf: (team) => `${companyOf(team).name} · ${domainOf(team).name} · ${tribeOf(team).name}`,
  };
}

/** Sorted views used by layouts and the sidebar tree. */
export function companiesInOrder(snapshot: RegistrySnapshot): Company[] {
  return [...snapshot.companies].sort((a, b) => a.position - b.position);
}

export function domainsOfCompany(snapshot: RegistrySnapshot, companySlug: string): Domain[] {
  return snapshot.domains
    .filter((d) => d.companySlug === companySlug)
    .sort((a, b) => a.position - b.position);
}

export function tribesOfDomain(snapshot: RegistrySnapshot, domainSlug: string): Tribe[] {
  return snapshot.tribes
    .filter((t) => t.domainSlug === domainSlug)
    .sort((a, b) => a.position - b.position);
}
