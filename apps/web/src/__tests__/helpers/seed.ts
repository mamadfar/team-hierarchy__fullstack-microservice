import { SeedFileSchema, type RegistrySnapshot } from '@orbit/shared';
import rawSeed from '../../../../../infra/db/seed/registry.json';

/** Flattens the canonical seed fixture into the RegistrySnapshot the API serves. */
export function snapshotFromSeed(): RegistrySnapshot {
  const seed = SeedFileSchema.parse(rawSeed);
  return {
    group: seed.group,
    companies: seed.companies.map(({ domains: _d, tribes: _t, teams, ...company }) => ({
      ...company,
      teamCount: teams.length,
    })),
    domains: seed.companies.flatMap((c) =>
      c.domains.map((d) => ({ ...d, companySlug: c.slug })),
    ),
    tribes: seed.companies.flatMap((c) => c.tribes),
    teams: seed.companies.flatMap((c) => c.teams),
    links: seed.links,
    lastSync: '2026-01-01T00:00:00.000Z',
  };
}
