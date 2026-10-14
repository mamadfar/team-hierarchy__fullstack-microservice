import { describe, expect, it } from 'vitest';

import { SeedSource } from '../seed-source';

describe('SeedSource', () => {
  it('loads and validates the canonical seed fixture', () => {
    const registry = new SeedSource().load();

    expect(registry.pages).toBe(3);
    expect(registry.companies).toHaveLength(3);
    const teams = registry.companies.flatMap((c) => c.teams);
    expect(teams).toHaveLength(111);
    expect(new Set(teams.map((team) => team.queueKey)).size).toBe(teams.length);
    expect(registry.companies.map((company) => company.teams.length)).toEqual([34, 38, 39]);
    expect(registry.links).toHaveLength(30);

    // domains got their companySlug stamped during flattening
    for (const parsedCompany of registry.companies) {
      for (const team of parsedCompany.teams) {
        expect(parsedCompany.tribes.some((tribe) => tribe.slug === team.tribeSlug)).toBe(true);
      }
      for (const domain of parsedCompany.domains) {
        expect(domain.companySlug).toBe(parsedCompany.company.slug);
      }
    }
  });
});
