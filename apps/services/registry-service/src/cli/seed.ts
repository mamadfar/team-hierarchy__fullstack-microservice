/**
 * `pnpm run db:seed` — migrates, then runs a mock sync (seed fixture) against
 * DATABASE_URL. Same code path as the boot/manual sync with MOCK_CONFLUENCE
 * forced on; dev-only convenience.
 */
import 'reflect-metadata';

import { drizzle } from 'drizzle-orm/node-postgres';
import Redis from 'ioredis';
import { Pool } from 'pg';

import * as schema from '@orbit/shared/db';

import { parseEnv } from '../config/env';
import { ConfluenceClient } from '../confluence/confluence.client';
import { ConfluencePageParser } from '../confluence/confluence-page.parser';
import { Migrator } from '../database/migrator';
import { TeamDocumentBuilder } from '../sync/document-builder';
import { SeedSource } from '../sync/seed-source';
import { SyncRepository } from '../sync/sync.repository';
import { SyncService } from '../sync/sync.service';

async function main(): Promise<void> {
  const env = { ...parseEnv(process.env), MOCK_CONFLUENCE: true };
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const redis = new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
  try {
    await new Migrator(pool).run();

    const db = drizzle(pool, { schema });
    const syncService = new SyncService(
      env,
      new SeedSource(),
      new ConfluenceClient(env),
      new ConfluencePageParser(),
      new SyncRepository(db, new TeamDocumentBuilder()),
      redis,
    );
    const result = await syncService.run('manual');
    console.log(`[db:seed] sync run #${result.runId} ok: ${JSON.stringify(result.stats)}`);
  } finally {
    try {
      await redis.quit();
    } catch {
      redis.disconnect();
    }
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error('[db:seed] failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
