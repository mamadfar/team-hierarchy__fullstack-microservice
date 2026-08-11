import { describe, expect, it, vi } from 'vitest';
import type { SchedulerRegistry } from '@nestjs/schedule';

import { AppError } from '../../common/app-error';
import { parseEnv } from '../../config/env';
import type { SyncService } from '../sync.service';
import { SyncScheduler } from '../sync.scheduler';

function makeScheduler(cron: string | undefined) {
  const registry = { addCronJob: vi.fn() };
  const syncService = { run: vi.fn().mockResolvedValue({ runId: 1 }) };
  const scheduler = new SyncScheduler(
    parseEnv(cron === undefined ? {} : { SYNC_CRON: cron }),
    syncService as unknown as SyncService,
    registry as unknown as SchedulerRegistry,
  );
  return { scheduler, registry, syncService };
}

describe('SyncScheduler', () => {
  it('registers nothing when SYNC_CRON is unset', () => {
    const { scheduler, registry } = makeScheduler(undefined);
    scheduler.onModuleInit();
    expect(registry.addCronJob).not.toHaveBeenCalled();
  });

  it('registers nothing when SYNC_CRON is an inline-comment remnant', () => {
    const { scheduler, registry } = makeScheduler(
      '# optional cron, e.g. "0 * * * *" (empty = off)',
    );
    scheduler.onModuleInit();
    expect(registry.addCronJob).not.toHaveBeenCalled();
  });

  it('registers and starts the cron job when SYNC_CRON is set', () => {
    const { scheduler, registry } = makeScheduler('0 * * * *');
    scheduler.onModuleInit();
    expect(registry.addCronJob).toHaveBeenCalledTimes(1);
    const job = registry.addCronJob.mock.calls[0]?.[1] as { stop: () => void };
    job.stop(); // don't leak a live timer out of the test
  });

  it('rejects an invalid cron expression with a clear AppError', () => {
    const { scheduler } = makeScheduler('not a cron');
    try {
      scheduler.onModuleInit();
      expect.unreachable('must throw');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).message).toContain('SYNC_CRON');
    }
  });
});
