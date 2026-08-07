import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';

import { AppError } from '../common/app-error';
import { ENV, Env } from '../config/env';
import { SyncService } from './sync.service';

const JOB_NAME = 'registry-sync-cron';

/** Registers the optional SYNC_CRON job — only when the env var is set. */
@Injectable()
export class SyncScheduler implements OnModuleInit {
  private readonly logger = new Logger(SyncScheduler.name);

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly syncService: SyncService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    const expression = this.env.SYNC_CRON?.trim();
    if (!expression) return;

    let job: CronJob;
    try {
      job = new CronJob(expression, () => {
        void this.tick();
      });
    } catch (error) {
      throw new AppError(
        500,
        `Invalid SYNC_CRON expression "${expression}": ${error instanceof Error ? error.message : error}`,
      );
    }
    this.schedulerRegistry.addCronJob(JOB_NAME, job);
    job.start();
    this.logger.log(`Scheduled sync registered: "${expression}"`);
  }

  private async tick(): Promise<void> {
    try {
      await this.syncService.run('cron');
    } catch (error) {
      this.logger.error(
        `Scheduled sync failed: ${error instanceof Error ? error.message : error}`,
      );
    }
  }
}
