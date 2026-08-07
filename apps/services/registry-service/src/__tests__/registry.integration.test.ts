/**
 * End-to-end integration: real AppModule against dockerized postgres + redis
 * (`make test-integration` boots them via docker-compose.dev).
 *
 * Uses its own database (orbit_registry_test) rebuilt from scratch each run so
 * the boot sync (MOCK_CONFLUENCE seed) always executes: migrator DDL -> boot
 * sync -> HTTP API assertions, including the sync token guard and rate limit.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Client } from 'pg';
import request from 'supertest';
import { RegistrySnapshotSchema } from '@orbit/shared';

const BASE_DB_URL = process.env.DATABASE_URL ?? 'postgres://orbit:orbit@localhost:5433/orbit';
const TEST_DB_NAME = 'orbit_registry_test';
const TEST_TOKEN = 'integration-sync-token';

function testDbUrl(): string {
  const url = new URL(BASE_DB_URL);
  url.pathname = `/${TEST_DB_NAME}`;
  return url.toString();
}

async function recreateDatabase(): Promise<void> {
  const admin = new Client({ connectionString: BASE_DB_URL });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB_NAME} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${TEST_DB_NAME}`);
  await admin.end();
}

describe('registry-service (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await recreateDatabase();

    process.env.DATABASE_URL = testDbUrl();
    process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6380';
    process.env.MOCK_CONFLUENCE = 'true';
    process.env.SYNC_APP_TOKEN = TEST_TOKEN;
    process.env.NODE_ENV = 'test';

    // Import after env is final so the ENV provider parses the test values.
    const { AppModule } = await import('../app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    // init() runs Migrator.onModuleInit then SyncService.onApplicationBootstrap (boot sync).
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('boot sync ingested the seed and GET /registry returns a valid snapshot', async () => {
    const res = await request(app.getHttpServer()).get('/registry').expect(200);
    const snapshot = RegistrySnapshotSchema.parse(res.body);
    expect(snapshot.group.name).toBe('Aurora Group');
    expect(snapshot.companies).toHaveLength(3);
    expect(snapshot.teams).toHaveLength(81);
    expect(snapshot.links).toHaveLength(30);
    expect(snapshot.lastSync).not.toBeNull();
    // display order preserved from the seed's position
    expect(snapshot.companies.map((c) => c.slug)).toEqual(['nova', 'lumen', 'shared']);
    // team hue fallback data intact (RISK-BOT has its own hue in the seed)
    const bot = snapshot.teams.find((t) => t.queueKey === 'RISK-BOT');
    expect(bot?.hue).toBe(15);
  });

  it('GET /teams/:queueKey returns one team, unknown key -> sanitized 404', async () => {
    const ok = await request(app.getHttpServer()).get('/teams/PAY-CHK').expect(200);
    expect(ok.body.name).toBe('Checkout');
    expect(ok.body.apps).toContain('Pay SDK');

    const missing = await request(app.getHttpServer()).get('/teams/NOPE-XX').expect(404);
    expect(missing.body).toMatchObject({ status: 404 });
    expect(typeof missing.body.message).toBe('string');
    expect(missing.body.stack).toBeUndefined();
  });

  it('GET /sync/runs records the boot run with stats', async () => {
    const res = await request(app.getHttpServer()).get('/sync/runs').expect(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    const latest = res.body[0];
    expect(latest.status).toBe('success');
    expect(latest.stats.teams).toBe(81);
    expect(latest.stats.trigger).toBe('boot');
  });

  it('GET /health reports db + redis up', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('POST /sync enforces the bearer token, re-runs idempotently, then rate-limits', async () => {
    const http = () => request(app.getHttpServer());

    await http().post('/sync').expect(401);
    await http().post('/sync').set('Authorization', 'Bearer wrong-token').expect(401);

    const ok = await http().post('/sync').set('Authorization', `Bearer ${TEST_TOKEN}`).expect(200);
    expect(ok.body.status).toBe('ok');
    expect(ok.body.stats.teams).toBe(81);
    expect(ok.body.stats.trigger).toBe('manual');

    // idempotent: same counts, snapshot still valid after cache bust
    const snap = await http().get('/registry').expect(200);
    expect(RegistrySnapshotSchema.parse(snap.body).teams).toHaveLength(81);

    // 4th hit inside the 60s window exceeds the 3/min throttle
    await http().post('/sync').set('Authorization', `Bearer ${TEST_TOKEN}`).expect(429);
  });
});
