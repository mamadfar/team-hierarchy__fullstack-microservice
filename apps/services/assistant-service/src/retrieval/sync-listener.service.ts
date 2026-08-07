import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import Redis from 'ioredis';
import { ENV } from '../config/env';
import type { Env } from '../config/env';
import { IndexService } from './index.service';

/** Channel registry-service publishes to after every successful sync. */
export const SYNC_COMPLETED_CHANNEL = 'orbit:sync:completed';

/**
 * Redis SUBSCRIBE "orbit:sync:completed" → rebuild the BM25 index and
 * re-embed the docs. Connection failures never take the service down; ioredis
 * reconnects with its default backoff and we just log.
 */
@Injectable()
export class SyncListenerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(SyncListenerService.name);
  private subscriber: Redis | null = null;

  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(IndexService) private readonly index: IndexService,
  ) {}

  onApplicationBootstrap(): void {
    const sub = new Redis(this.env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
      enableOfflineQueue: true,
    });
    this.subscriber = sub;

    sub.on('error', (err) => this.logger.warn(`redis subscriber error: ${err.message}`));
    sub
      .connect()
      .then(() => sub.subscribe(SYNC_COMPLETED_CHANNEL))
      .then(() => this.logger.log(`subscribed to "${SYNC_COMPLETED_CHANNEL}"`))
      .catch((err: Error) =>
        this.logger.warn(`could not subscribe to "${SYNC_COMPLETED_CHANNEL}": ${err.message}`),
      );

    sub.on('message', (channel) => {
      if (channel !== SYNC_COMPLETED_CHANNEL) return;
      this.logger.log('registry sync completed — rebuilding retrieval index');
      void this.index.rebuildWithRetry();
    });
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.subscriber) {
      this.subscriber.disconnect();
      this.subscriber = null;
    }
  }
}
