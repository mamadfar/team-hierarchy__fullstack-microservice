import { Global, Inject, Injectable, Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from '@orbit/shared/db';

import { ENV, Env } from '../config/env';
import { DRIZZLE, PG_POOL } from './database.tokens';
import { Migrator } from './migrator';

export type Db = NodePgDatabase<typeof schema>;

/** Closes the pool on app shutdown so tests and SIGTERM drain cleanly. */
@Injectable()
class PoolLifecycle implements OnModuleDestroy {
  private readonly logger = new Logger('Database');

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onModuleDestroy(): Promise<void> {
    await this.pool.end().catch((error: unknown) => {
      this.logger.warn(`pg pool close failed: ${error instanceof Error ? error.message : error}`);
    });
  }
}

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: (env: Env) => new Pool({ connectionString: env.DATABASE_URL, max: 10 }),
      inject: [ENV],
    },
    {
      provide: DRIZZLE,
      useFactory: (pool: Pool): Db => drizzle(pool, { schema }),
      inject: [PG_POOL],
    },
    Migrator,
    PoolLifecycle,
  ],
  exports: [PG_POOL, DRIZZLE, Migrator],
})
export class DatabaseModule {}
