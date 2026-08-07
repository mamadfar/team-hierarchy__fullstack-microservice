import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Redis from 'ioredis';

import { AppError } from '../../common/app-error';
import { REGISTRY_SNAPSHOT_CACHE_KEY } from '../../common/constants';
import { parseEnv } from '../../config/env';
import type { RegistryRepository } from '../registry.repository';
import { RegistryService } from '../registry.service';

const companyRow = {
  slug: 'nova',
  name: 'NovaPay',
  icon: 'wallet',
  hue: 245,
  description: 'Payments arm',
  confluencePageId: '84213977',
  position: 0,
};
const teamRow = {
  team: {
    queueKey: 'PAY-CHK',
    name: 'Checkout',
    description: 'Hosted checkout',
    icon: 'cart',
    hue: null,
    apps: ['Checkout Web'],
    keywords: ['payment failed'],
    channel: '#pay-checkout',
    lead: 'Mara Kis',
    oncall: null,
  },
  tribeSlug: 'pay-acc',
  companySlug: 'nova',
};

describe('RegistryService', () => {
  let repository: Record<string, ReturnType<typeof vi.fn>>;
  let redis: Record<string, ReturnType<typeof vi.fn>>;
  let service: RegistryService;

  beforeEach(() => {
    repository = {
      findCompanies: vi.fn().mockResolvedValue([companyRow]),
      findDomains: vi.fn().mockResolvedValue([
        { domain: { slug: 'pay', name: 'Payments & Billing', hue: 215, description: '', position: 0 }, companySlug: 'nova' },
      ]),
      findTribes: vi.fn().mockResolvedValue([
        { tribe: { slug: 'pay-acc', name: 'Acceptance', position: 0 }, domainSlug: 'pay' },
      ]),
      findTeams: vi.fn().mockResolvedValue([teamRow]),
      findLinks: vi.fn().mockResolvedValue([{ sourceKey: 'PAY-CHK', targetKey: 'PAY-CHK', reason: 'self' }]),
      findLastSuccessfulSync: vi.fn().mockResolvedValue(new Date('2026-08-07T09:00:00Z')),
      findTeamByQueueKey: vi.fn().mockResolvedValue({ team: teamRow.team, tribeSlug: 'pay-acc' }),
      findRecentSyncRuns: vi.fn().mockResolvedValue([]),
      pingDb: vi.fn().mockResolvedValue(undefined),
    };
    redis = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
      ping: vi.fn().mockResolvedValue('PONG'),
    };
    service = new RegistryService(
      parseEnv({ GROUP_NAME: 'Aurora Group' }),
      repository as unknown as RegistryRepository,
      redis as unknown as Redis,
    );
  });

  it('cache miss: assembles a schema-valid snapshot from the DB and writes the cache', async () => {
    const snapshot = await service.getSnapshot();

    expect(snapshot.group.name).toBe('Aurora Group');
    expect(snapshot.companies[0]).toMatchObject({ slug: 'nova', teamCount: 1 });
    expect(snapshot.teams[0]).toMatchObject({ queueKey: 'PAY-CHK', tribeSlug: 'pay-acc' });
    expect(snapshot.lastSync).toBe('2026-08-07T09:00:00.000Z');
    expect(redis.set).toHaveBeenCalledWith(
      REGISTRY_SNAPSHOT_CACHE_KEY,
      expect.any(String),
      'EX',
      3600,
    );
  });

  it('cache hit: serves from Redis without touching the repository', async () => {
    const cached = await service.getSnapshot(); // primes via DB
    redis.get!.mockResolvedValue(JSON.stringify(cached));
    repository.findCompanies!.mockClear();

    const snapshot = await service.getSnapshot();
    expect(snapshot).toEqual(cached);
    expect(repository.findCompanies).not.toHaveBeenCalled();
  });

  it('corrupt cache entries fall back to the DB instead of failing the request', async () => {
    redis.get!.mockResolvedValue('{not json');
    const snapshot = await service.getSnapshot();
    expect(snapshot.companies).toHaveLength(1);
    expect(repository.findCompanies).toHaveBeenCalled();
  });

  it('redis being down degrades to direct DB reads', async () => {
    redis.get!.mockRejectedValue(new Error('ECONNREFUSED'));
    redis.set!.mockRejectedValue(new Error('ECONNREFUSED'));
    const snapshot = await service.getSnapshot();
    expect(snapshot.teams).toHaveLength(1);
  });

  it('unknown queue key -> 404 AppError', async () => {
    repository.findTeamByQueueKey!.mockResolvedValue(null);
    const failure = await service.getTeamByQueueKey('NOPE-XX').catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(AppError);
    expect((failure as AppError).status).toBe(404);
  });

  it('health: db up + redis down still reports ok with redis flagged', async () => {
    redis.ping!.mockRejectedValue(new Error('down'));
    await expect(service.getHealth()).resolves.toEqual({ status: 'ok', db: 'up', redis: 'down' });
  });

  it('health: db down -> 503', async () => {
    repository.pingDb!.mockRejectedValue(new Error('down'));
    const failure = await service.getHealth().catch((e: unknown) => e);
    expect((failure as AppError).status).toBe(503);
  });
});
