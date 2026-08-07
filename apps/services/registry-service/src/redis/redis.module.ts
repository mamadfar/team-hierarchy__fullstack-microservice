import { Global, Inject, Injectable, Logger, Module, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

import { ENV, Env } from '../config/env';

/** Injection token for the shared ioredis client. */
export const REDIS = Symbol('ORBIT_REDIS');

@Injectable()
class RedisLifecycle implements OnModuleDestroy {
  private readonly logger = new Logger('Redis');

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async onModuleDestroy(): Promise<void> {
    try {
      await this.redis.quit();
    } catch {
      this.redis.disconnect();
    }
  }
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      useFactory: (env: Env) =>
        new Redis(env.REDIS_URL, {
          maxRetriesPerRequest: 2,
          retryStrategy: (times: number) => Math.min(times * 200, 2000),
          enableOfflineQueue: true,
        }),
      inject: [ENV],
    },
    RedisLifecycle,
  ],
  exports: [REDIS],
})
export class RedisModule {}
