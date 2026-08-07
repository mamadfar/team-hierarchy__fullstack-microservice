/**
 * Chat controller integration test against dockerized postgres + redis
 * (`make test-integration` boots them via docker-compose.dev).
 *
 * Uses its own database (orbit_assistant_test) so it never touches
 * registry-service data, creates the minimal tables itself (teams +
 * team_documents — DDL parity with @orbit/shared/db for the columns we use),
 * inserts a few teams + docs, then boots the real AppModule with the LLM
 * provider stubbed (no API key / network needed).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Client } from 'pg';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { IndexService } from '../../retrieval/index.service';
import { flattenTeamDoc } from '../../retrieval/core/doc-shaper';
import { AnswerDraft, LLM, RoutingLlm } from '../llm.provider';

const BASE_DB_URL = process.env.DATABASE_URL ?? 'postgres://orbit:orbit@localhost:5433/orbit';
const TEST_DB_NAME = 'orbit_assistant_test';

function testDbUrl(): string {
  const url = new URL(BASE_DB_URL);
  url.pathname = `/${TEST_DB_NAME}`;
  return url.toString();
}

const seedTeams = [
  {
    queueKey: 'PAY-CHK',
    name: 'Checkout',
    company: 'NovaPay',
    domain: 'Payments & Billing',
    tribe: 'Acceptance',
    description: 'Hosted checkout, card forms, Apple Pay and Google Pay buttons.',
    apps: ['Checkout Web', 'Pay SDK'],
    keywords: ['payment failed', 'checkout error', 'apple pay', '3ds'],
    channel: '#pay-checkout',
    lead: 'Mara Kis',
    oncall: 'pay-checkout-oncall',
  },
  {
    queueKey: 'PLT-IAM',
    name: 'IAM Platform',
    company: 'Aurora Shared Services',
    domain: 'Core Platform',
    tribe: 'Security Engineering',
    description: 'Workforce SSO, customer auth tokens and permission model.',
    apps: ['SSO Broker', 'AuthZ Core'],
    keywords: ['sso', 'password reset', 'permissions', 'access denied', 'mfa'],
    channel: '#iam',
    lead: 'Marton Fehér',
    oncall: 'iam-oncall',
  },
  {
    queueKey: 'OPS-IT',
    name: 'Workplace IT',
    company: 'Aurora Shared Services',
    domain: 'Internal Operations',
    tribe: 'Employee Tech',
    description: 'Employee helpdesk, accounts, wifi, printers and office AV.',
    apps: ['IT Helpdesk'],
    keywords: ['laptop broken', 'wifi', 'printer', 'new starter account', 'vpn'],
    channel: '#it-helpdesk',
    lead: 'Katalin Papp',
    oncall: 'it-oncall',
  },
];

async function prepareDatabase(): Promise<void> {
  const admin = new Client({ connectionString: BASE_DB_URL });
  await admin.connect();
  const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [TEST_DB_NAME]);
  if (exists.rowCount === 0) {
    await admin.query(`CREATE DATABASE ${TEST_DB_NAME}`);
  }
  await admin.end();

  const db = new Client({ connectionString: testDbUrl() });
  await db.connect();
  await db.query('CREATE EXTENSION IF NOT EXISTS vector');
  await db.query('DROP TABLE IF EXISTS team_documents');
  await db.query('DROP TABLE IF EXISTS teams');
  await db.query(`
    CREATE TABLE teams (
      id serial PRIMARY KEY,
      queue_key text NOT NULL UNIQUE,
      name text NOT NULL,
      tribe_id integer NOT NULL,
      description text NOT NULL DEFAULT '',
      icon text NOT NULL DEFAULT 'box',
      hue integer,
      apps text[] NOT NULL DEFAULT '{}',
      keywords text[] NOT NULL DEFAULT '{}',
      channel text,
      lead text,
      oncall text,
      raw jsonb,
      search_tsv tsvector
    )
  `);
  await db.query(`
    CREATE TABLE team_documents (
      id serial PRIMARY KEY,
      team_id integer NOT NULL UNIQUE REFERENCES teams(id) ON DELETE CASCADE,
      content text NOT NULL,
      embedding vector(1536),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  for (const t of seedTeams) {
    const inserted = await db.query(
      `INSERT INTO teams (queue_key, name, tribe_id, description, apps, keywords, channel, lead, oncall)
       VALUES ($1, $2, 1, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [t.queueKey, t.name, t.description, t.apps, t.keywords, t.channel, t.lead, t.oncall],
    );
    const teamId = (inserted.rows[0] as { id: number }).id;
    const content = flattenTeamDoc({
      name: t.name,
      queueKey: t.queueKey,
      company: t.company,
      domain: t.domain,
      tribe: t.tribe,
      description: t.description,
      apps: t.apps,
      keywords: t.keywords,
      channel: t.channel,
      lead: t.lead,
      oncall: t.oncall,
    });
    await db.query('INSERT INTO team_documents (team_id, content) VALUES ($1, $2)', [
      teamId,
      content,
    ]);
  }
  await db.end();
}

async function waitForIndex(app: INestApplication): Promise<void> {
  const index = app.get(IndexService);
  const deadline = Date.now() + 20_000;
  while (!index.isReady && Date.now() < deadline) {
    await index.rebuildWithRetry();
    if (index.isReady) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!index.isReady) throw new Error('retrieval index did not become ready in time');
}

/** LLM stub: echoes a grounded answer + one invented key (must be filtered out). */
const stubLlm: RoutingLlm = {
  async invoke() {
    return { content: 'checkout payment failed apple pay card' };
  },
  withStructuredOutput() {
    return {
      async invoke(): Promise<AnswerDraft> {
        return {
          answer: 'Send this to Checkout (PAY-CHK), they own the hosted payment page.',
          teams: [
            { queueKey: 'PAY-CHK', confidence: 0.9 },
            { queueKey: 'FAKE-XX', confidence: 0.95 },
          ],
        };
      },
    };
  },
};

describe('assistant-service integration', () => {
  beforeAll(async () => {
    await prepareDatabase();
    process.env.DATABASE_URL = testDbUrl();
    process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6380';
    process.env.EMBEDDING_PROVIDER = 'mock';
    delete process.env.ANTHROPIC_API_KEY;
  });

  describe('with a stubbed LLM', () => {
    let app: INestApplication;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(LLM)
        .useValue(stubLlm)
        .compile();
      app = moduleRef.createNestApplication();
      await app.init();
      await waitForIndex(app);
    });

    afterAll(async () => {
      await app?.close();
    });

    it('GET /health reports a ready index with the inserted docs', async () => {
      const res = await request(app.getHttpServer()).get('/health').expect(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.index.ready).toBe(true);
      expect(res.body.index.docs).toBe(seedTeams.length);
      expect(res.body.embeddings).toBe('mock');
    });

    it('POST /chat answers with structured teams and drops invented keys', async () => {
      const res = await request(app.getHttpServer())
        .post('/chat')
        .send({
          messages: [{ role: 'user', content: 'payment failed at checkout with apple pay' }],
          lang: 'en',
        })
        .expect(200);

      expect(typeof res.body.answer).toBe('string');
      expect(res.body.answer).toContain('PAY-CHK');
      // FAKE-XX was returned by the model but never retrieved -> filtered.
      expect(res.body.teams).toEqual([
        { queueKey: 'PAY-CHK', name: 'Checkout', confidence: 0.9 },
      ]);
    });

    it('POST /chat rejects invalid bodies with { status, message }', async () => {
      const res = await request(app.getHttpServer())
        .post('/chat')
        .send({ messages: [], lang: 'en' })
        .expect(400);
      expect(res.body.status).toBe(400);
      expect(typeof res.body.message).toBe('string');
    });
  });

  describe('without an LLM (offline fallback mode)', () => {
    let app: INestApplication;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(LLM)
        .useValue(null)
        .compile();
      app = moduleRef.createNestApplication();
      await app.init();
      await waitForIndex(app);
    });

    afterAll(async () => {
      await app?.close();
    });

    it('POST /chat serves the deterministic extractive answer from retrieval', async () => {
      const res = await request(app.getHttpServer())
        .post('/chat')
        .send({
          messages: [{ role: 'user', content: 'the office wifi is down and the printer is broken' }],
          lang: 'en',
        })
        .expect(200);

      expect(res.body.answer).toContain('Workplace IT (OPS-IT)');
      expect(res.body.teams[0]).toMatchObject({ queueKey: 'OPS-IT', name: 'Workplace IT' });
      expect(res.body.teams.length).toBeLessThanOrEqual(3);
    });

    it('answers in the requested language (hu)', async () => {
      const res = await request(app.getHttpServer())
        .post('/chat')
        .send({
          messages: [{ role: 'user', content: 'sso password reset mfa access denied' }],
          lang: 'hu',
        })
        .expect(200);
      expect(res.body.answer).toContain('IAM Platform (PLT-IAM)');
      expect(res.body.answer).toContain('csapathoz');
    });
  });
});
