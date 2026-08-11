import type { RegistrySnapshot } from '@orbit/shared';

export type StarterFill = {
  whoHandles: (v: { name: string }) => string;
  aboutKeyword: (v: { keyword: string }) => string;
  aboutDomain: (v: { domain: string }) => string;
};

const LIMIT = 3;

/**
 * Build up to 3 Ask Orbit starter chips from the live registry snapshot
 * (team names, keywords, domains). Falls back when the registry is empty.
 */
export function buildChatStarters(
  snapshot: RegistrySnapshot | null | undefined,
  fill: StarterFill,
  fallback: readonly string[],
): string[] {
  const teams = snapshot?.teams ?? [];
  if (teams.length === 0) {
    return fallback.filter((s) => s.trim().length > 0).slice(0, LIMIT);
  }

  const out: string[] = [];
  const seen = new Set<string>();
  const push = (q: string) => {
    const text = q.trim();
    if (!text || seen.has(text) || out.length >= LIMIT) return;
    seen.add(text);
    out.push(text);
  };

  // 1) First team name — reflects whatever Confluence last synced (e.g. Helix).
  push(fill.whoHandles({ name: teams[0]!.name }));

  // 2) First real keyword across teams (skip empties).
  let keyword: string | undefined;
  for (const team of teams) {
    const kw = team.keywords.find((k) => k.trim().length > 0);
    if (kw) {
      keyword = kw.trim();
      break;
    }
  }
  if (keyword) push(fill.aboutKeyword({ keyword }));

  // 3) First domain name, else another team, else a queue key phrased as whoHandles.
  const domain = snapshot?.domains.find((d) => d.name.trim().length > 0);
  if (domain) push(fill.aboutDomain({ domain: domain.name.trim() }));

  for (let i = 1; i < teams.length && out.length < LIMIT; i += 1) {
    push(fill.whoHandles({ name: teams[i]!.name }));
  }

  return out.slice(0, LIMIT);
}

/** Short input hint from registry (keyword or team), else fallback example. */
export function buildChatPlaceholderHint(
  snapshot: RegistrySnapshot | null | undefined,
  fallback: string,
): string {
  const teams = snapshot?.teams ?? [];
  for (const team of teams) {
    const kw = team.keywords.find((k) => k.trim().length > 0);
    if (kw) return kw.trim();
  }
  if (teams[0]?.name) return teams[0].name;
  return fallback;
}
