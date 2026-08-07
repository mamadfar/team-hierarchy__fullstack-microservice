/**
 * `pnpm run db:migrate` — applies the bundled idempotent DDL and exits.
 * No Nest context: the Migrator is constructed directly.
 */
import 'reflect-metadata';

import { Pool } from 'pg';

import { parseEnv } from '../config/env';
import { Migrator } from '../database/migrator';

async function main(): Promise<void> {
  const env = parseEnv(process.env);
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  try {
    await new Migrator(pool).run();
    console.log('[db:migrate] done');
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error('[db:migrate] failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
