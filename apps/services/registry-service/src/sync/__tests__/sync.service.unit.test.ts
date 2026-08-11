import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Redis from 'ioredis';
import type { Team } from '@orbit/shared';

import { AppError } from '../../common/app-error';
import { REGISTRY_SNAPSHOT_CACHE_KEY, SYNC_COMPLETED_CHANNEL } from '../../common/constants';
import type { ApplyStats, ParsedCompany, ParsedRegistry } from '../../common/ingest.types';
import { parseEnv } from '../../config/env';
import type { ConfluenceClient } from '../../confluence/confluence.client';
import type { ConfluencePageParser } from '../../confluence/confluence-page.parser';
import type { SeedSource } from '../seed-source';
import type { SyncRepository } from '../sync.repository';
import { SyncService } from '../sync.service';

function team(queueKey: string, name: string, tribeSlug: string): Team {
  return {
    queueKey,
    name,
    tribeSlug,
    description: 'd',
    icon: 'box',
    hue: null,
    apps: [],
    keywords: [],
    channel: null,
    lead: null,
    oncall: null,
  };
}

function company(slug: string, name: string, teams: Team[]): ParsedCompany {
  return {
    company: {
      slug,
      name,
      icon: 'wallet',
      hue: 200,
      description: '',
      confluencePageId: `page-${slug}`,
      position: 0,
    },
    domains: [{ slug: `${slug}-dom`, companySlug: slug, name: 'Dom', hue: 100, description: '', position: 0 }],
    tribes: [{ slug: `${slug}-tribe`, domainSlug: `${slug}-dom`, name: 'Tribe', position: 0 }],
    teams,
  };
}

const APPLY_OK: ApplyStats = {
  companies: 2,
  domains: 2,
  tribes: 2,
  teams: 3,
  links: 1,
  linksSkipped: ['PAY-XX -> GONE-YY (target missing)'],
  docsRebuilt: 3,
};

describe('SyncService', () => {
  let repository: {
    createRun: ReturnType<typeof vi.fn>;
    completeRun: ReturnType<typeof vi.fn>;
    failRun: ReturnType<typeof vi.fn>;
    hasSuccessfulRunWithData: ReturnType<typeof vi.fn>;
    applySnapshot: ReturnType<typeof vi.fn>;
  };
  let redis: { del: ReturnType<typeof vi.fn>; publish: ReturnType<typeof vi.fn> };
  let seedSource: { load: ReturnType<typeof vi.fn> };
  let service: SyncService;

  const makeService = () => {
    const pool = {
      connect: vi.fn().mockResolvedValue({
        query: vi.fn().mockResolvedValue({ rows: [{ ok: true }] }),
        release: vi.fn(),
      }),
    };
    return new SyncService(
      parseEnv({ MOCK_CONFLUENCE: 'true', SYNC_APP_TOKEN: 't' }),
      pool as never,
      seedSource as unknown as SeedSource,
      { getPageStorage: vi.fn() } as unknown as ConfluenceClient,
      { parsePage: vi.fn() } as unknown as ConfluencePageParser,
      repository as unknown as SyncRepository,
      redis as unknown as Redis,
    );
  };

  beforeEach(() => {
    repository = {
      createRun: vi.fn().mockResolvedValue(7),
      completeRun: vi.fn().mockResolvedValue(new Date('2026-08-07T10:00:00Z')),
      failRun: vi.fn().mockResolvedValue(undefined),
      hasSuccessfulRunWithData: vi.fn().mockResolvedValue(false),
      applySnapshot: vi.fn().mockResolvedValue(APPLY_OK),
    };
    redis = { del: vi.fn().mockResolvedValue(1), publish: vi.fn().mockResolvedValue(1) };
    const registry: ParsedRegistry = {
      pages: 2,
      companies: [
        company('nova', 'NovaPay', [team('PAY-CHK', 'Checkout', 'nova-tribe'), team('PAY-OUT', 'Payouts', 'nova-tribe')]),
        company('lumen', 'Lumen', [team('CG-SEO', 'SEO', 'lumen-tribe')]),
      ],
      links: [{ source: 'PAY-CHK', target: 'CG-SEO', reason: 'r' }],
    };
    seedSource = { load: vi.fn().mockReturnValue(registry) };
    service = makeService();
  });

  it('happy path: applies, records the run, busts cache and publishes completion', async () => {
    const result = await service.run('manual');

    expect(result.runId).toBe(7);
    expect(result.stats).toMatchObject({ trigger: 'manual', pages: 2, teams: 3, links: 1, docsRebuilt: 3 });
    expect(result.stats.rowErrors[0]).toContain('link skipped');
    expect(repository.completeRun).toHaveBeenCalledWith(7, expect.objectContaining({ teams: 3 }));
    expect(redis.del).toHaveBeenCalledWith(REGISTRY_SNAPSHOT_CACHE_KEY);
    expect(redis.publish).toHaveBeenCalledWith(SYNC_COMPLETED_CHANNEL, expect.stringContaining('"runId":7'));
    expect(repository.failRun).not.toHaveBeenCalled();
  });

  it('duplicate queue key across companies fails naming BOTH offending rows', async () => {
    seedSource.load.mockReturnValue({
      pages: 2,
      companies: [
        company('nova', 'NovaPay', [team('PAY-CHK', 'Checkout', 'nova-tribe')]),
        company('lumen', 'Lumen', [team('PAY-CHK', 'Copycat', 'lumen-tribe')]),
      ],
      links: [],
    } satisfies ParsedRegistry);

    const failure = await service.run('manual').catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(AppError);
    expect((failure as AppError).status).toBe(422);
    const message = (failure as AppError).message;
    expect(message).toContain('PAY-CHK');
    expect(message).toContain('Checkout');
    expect(message).toContain('NovaPay');
    expect(message).toContain('Copycat');
    expect(message).toContain('Lumen');
    expect(repository.failRun).toHaveBeenCalledWith(7, expect.stringContaining('PAY-CHK'), expect.anything());
    expect(redis.del).not.toHaveBeenCalled();
  });

  it('two pages resolving to one company slug fail the sync', async () => {
    seedSource.load.mockReturnValue({
      pages: 2,
      companies: [company('nova', 'NovaPay', []), company('nova', 'NovaPay Again', [])],
      links: [],
    } satisfies ParsedRegistry);

    const failure = await service.run('manual').catch((e: unknown) => e);
    expect((failure as AppError).status).toBe(422);
    expect((failure as AppError).message).toContain('nova');
  });

  it('apply failure records a failed run and rethrows as an operational error', async () => {
    repository.applySnapshot.mockRejectedValue(new Error('deadlock detected'));

    const failure = await service.run('cron').catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(AppError);
    expect((failure as AppError).message).toContain('deadlock detected');
    expect(repository.failRun).toHaveBeenCalledWith(7, expect.stringContaining('deadlock'), expect.anything());
    expect(redis.publish).not.toHaveBeenCalled();
  });

  it('rejects a second run while one is in flight (409), then allows the next', async () => {
    let release!: (value: ApplyStats) => void;
    repository.applySnapshot.mockImplementation(
      () => new Promise<ApplyStats>((resolve) => { release = resolve; }),
    );

    const first = service.run('manual');
    await vi.waitFor(() => expect(repository.applySnapshot).toHaveBeenCalled());

    const second = await service.run('manual').catch((e: unknown) => e);
    expect(second).toBeInstanceOf(AppError);
    expect((second as AppError).status).toBe(409);

    release(APPLY_OK);
    await first;

    repository.applySnapshot.mockResolvedValue(APPLY_OK);
    await expect(service.run('manual')).resolves.toMatchObject({ runId: 7 });
  });

  it('boot policy: skips the boot sync when a successful run with data exists', async () => {
    repository.hasSuccessfulRunWithData.mockResolvedValue(true);
    await service.onApplicationBootstrap();
    expect(repository.createRun).not.toHaveBeenCalled();
  });

  it('boot policy: boot sync failures are swallowed (service keeps serving)', async () => {
    repository.applySnapshot.mockRejectedValue(new Error('db down'));
    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
    expect(repository.failRun).toHaveBeenCalled();
  });
});
