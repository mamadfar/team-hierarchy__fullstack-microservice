import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { Injectable } from '@nestjs/common';

import { SeedFileSchema } from '@orbit/shared';

import { AppError } from '../common/app-error';
import { formatZodError } from '../common/zod-error';
import type { ParsedRegistry } from '../common/ingest.types';

const SEED_RELATIVE = ['infra', 'db', 'seed', 'registry.json'] as const;

/**
 * MOCK_CONFLUENCE=true source: the canonical seed fixture
 * infra/db/seed/registry.json. Resolution order: explicit SEED_PATH env
 * (docker images bake the seed at /app/seed/registry.json), then walking up
 * from both cwd and the compiled module directory (service dir / repo root).
 */
@Injectable()
export class SeedSource {
  load(): ParsedRegistry {
    const file = this.resolveSeedFile();
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(file, 'utf8'));
    } catch (error) {
      throw new AppError(
        500,
        `Seed file ${file} is not readable/parseable JSON: ${error instanceof Error ? error.message : error}`,
      );
    }
    const parsed = SeedFileSchema.safeParse(raw);
    if (!parsed.success) {
      throw new AppError(500, `Seed file ${file} failed validation: ${formatZodError(parsed.error)}`);
    }
    const seed = parsed.data;
    return {
      pages: seed.companies.length,
      companies: seed.companies.map((c) => ({
        company: {
          slug: c.slug,
          name: c.name,
          icon: c.icon,
          hue: c.hue,
          description: c.description,
          confluencePageId: c.confluencePageId,
          position: c.position,
        },
        domains: c.domains.map((d) => ({ ...d, companySlug: c.slug })),
        tribes: c.tribes,
        teams: c.teams,
      })),
      links: seed.links,
    };
  }

  private resolveSeedFile(): string {
    const explicit = process.env.SEED_PATH?.trim();
    if (explicit) {
      if (existsSync(explicit)) return explicit;
      throw new AppError(500, `SEED_PATH is set but not readable: ${explicit}`);
    }
    for (const start of [process.cwd(), __dirname]) {
      let dir = start;
      for (let depth = 0; depth < 10; depth += 1) {
        const candidate = join(dir, ...SEED_RELATIVE);
        if (existsSync(candidate)) return candidate;
        const parent = dirname(dir);
        if (parent === dir) break;
        dir = parent;
      }
    }
    throw new AppError(
      500,
      'Seed file infra/db/seed/registry.json not found (searched upward from cwd and the service directory)',
    );
  }
}
