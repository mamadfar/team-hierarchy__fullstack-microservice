import type { Team } from '@orbit/shared';
import type { RegistryIndex } from './registry';

/**
 * Exact port of the prototype's search() scoring:
 *   exact queue key 100 · key includes 60 · name prefix 70 · name includes 50 ·
 *   keywords 40 · apps 35 · tribe+domain path 25 · description 20.
 * Every whitespace token must match somewhere (AND); per-token scores are the
 * max across fields, summed over tokens; results sorted by total, top 40.
 */
export const SEARCH_LIMIT = 40;

interface Haystack {
  k: string;
  n: string;
  kw: string;
  a: string;
  path: string;
  d: string;
}

function haystackOf(team: Team, index: RegistryIndex): Haystack {
  const tribe = index.tribeOf(team);
  const domain = index.domainOf(team);
  return {
    k: team.queueKey.toLowerCase(),
    n: team.name.toLowerCase(),
    kw: team.keywords.join(' ').toLowerCase(),
    a: team.apps.join(' ').toLowerCase(),
    path: `${tribe.name} ${domain.name}`.toLowerCase(),
    d: team.description.toLowerCase(),
  };
}

export function scoreTeam(team: Team, index: RegistryIndex, tokens: string[]): number | null {
  const hay = haystackOf(team, index);
  let total = 0;
  for (const tok of tokens) {
    let s = 0;
    if (hay.k === tok) s = 100;
    else if (hay.k.includes(tok)) s = 60;
    if (hay.n.startsWith(tok)) s = Math.max(s, 70);
    else if (hay.n.includes(tok)) s = Math.max(s, 50);
    if (hay.kw.includes(tok)) s = Math.max(s, 40);
    if (hay.a.includes(tok)) s = Math.max(s, 35);
    if (hay.path.includes(tok)) s = Math.max(s, 25);
    if (hay.d.includes(tok)) s = Math.max(s, 20);
    if (!s) return null;
    total += s;
  }
  return total;
}

export function searchTeams(teams: readonly Team[], index: RegistryIndex, query: string): Team[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  const scored: Array<[number, Team]> = [];
  for (const team of teams) {
    const score = scoreTeam(team, index, tokens);
    if (score != null) scored.push([score, team]);
  }
  return scored
    .sort((a, b) => b[0] - a[0])
    .slice(0, SEARCH_LIMIT)
    .map((entry) => entry[1]);
}
