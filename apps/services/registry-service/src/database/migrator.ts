import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Pool } from 'pg';

import { AppError } from '../common/app-error';
import { PG_POOL } from './database.tokens';
import { splitSqlStatements } from './sql-splitter';

const MIGRATION_FILE = '0001_init.sql';

/**
 * Programmatic migrator: executes the bundled idempotent DDL inside one
 * transaction, guarded by an advisory lock so concurrent instances can't race.
 * Runs automatically at boot (onModuleInit — i.e. before any
 * onApplicationBootstrap sync) and via `pnpm run db:migrate`.
 */
@Injectable()
export class Migrator implements OnModuleInit {
  private readonly logger = new Logger(Migrator.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onModuleInit(): Promise<void> {
    await this.run();
  }

  async run(): Promise<void> {
    const statements = splitSqlStatements(this.loadSql());
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(492839021)');
      for (const statement of statements) {
        await client.query(statement);
      }
      await client.query('COMMIT');
      this.logger.log(`Migrations applied (${statements.length} statements, idempotent)`);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      const message = error instanceof Error ? error.message : String(error);
      throw new AppError(500, `Migration failed: ${message}`);
    } finally {
      client.release();
    }
  }

  private loadSql(): string {
    // dist/database -> dist/database/migrations (asset copied by nest build);
    // src/database -> src/database/migrations when running via tsx/vitest.
    const candidates = [
      join(__dirname, 'migrations', MIGRATION_FILE),
      join(process.cwd(), 'src', 'database', 'migrations', MIGRATION_FILE),
      join(
        process.cwd(),
        'apps',
        'services',
        'registry-service',
        'src',
        'database',
        'migrations',
        MIGRATION_FILE,
      ),
    ];
    for (const candidate of candidates) {
      if (existsSync(candidate)) return readFileSync(candidate, 'utf8');
    }
    throw new AppError(
      500,
      `Migration file ${MIGRATION_FILE} not found (looked in: ${candidates.join(', ')})`,
    );
  }
}
