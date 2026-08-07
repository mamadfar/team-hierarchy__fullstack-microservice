/**
 * Single Drizzle schema for the whole registry database.
 * Owned by registry-service (which runs the migrations); assistant-service
 * imports the table defs read-only via "@orbit/shared/db".
 *
 * search_tsv is written explicitly by the sync upsert SQL:
 *   setweight(to_tsvector('simple', queue_key || ' ' || name), 'A') ||
 *   setweight(to_tsvector('simple', keywords+apps), 'B') ||
 *   setweight(to_tsvector('simple', description), 'C')
 */
import {
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  vector,
} from 'drizzle-orm/pg-core';

const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
  },
});

export const companies = pgTable('companies', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  icon: text('icon').notNull(),
  hue: integer('hue').notNull(),
  description: text('description').notNull().default(''),
  confluencePageId: text('confluence_page_id').notNull(),
  position: integer('position').notNull(),
});

export const domains = pgTable('domains', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  companyId: integer('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  hue: integer('hue').notNull(),
  description: text('description').notNull().default(''),
  position: integer('position').notNull(),
});

export const tribes = pgTable('tribes', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  domainId: integer('domain_id')
    .notNull()
    .references(() => domains.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  position: integer('position').notNull(),
});

export const teams = pgTable(
  'teams',
  {
    id: serial('id').primaryKey(),
    queueKey: text('queue_key').notNull().unique(),
    name: text('name').notNull(),
    tribeId: integer('tribe_id')
      .notNull()
      .references(() => tribes.id, { onDelete: 'cascade' }),
    description: text('description').notNull().default(''),
    icon: text('icon').notNull().default('box'),
    hue: integer('hue'),
    apps: text('apps').array().notNull().default([]),
    keywords: text('keywords').array().notNull().default([]),
    channel: text('channel'),
    lead: text('lead'),
    oncall: text('oncall'),
    raw: jsonb('raw'),
    searchTsv: tsvector('search_tsv'),
  },
  (t) => [index('teams_search_tsv_idx').using('gin', t.searchTsv)],
);

export const teamLinks = pgTable(
  'team_links',
  {
    id: serial('id').primaryKey(),
    sourceKey: text('source_key')
      .notNull()
      .references(() => teams.queueKey, { onDelete: 'cascade' }),
    targetKey: text('target_key')
      .notNull()
      .references(() => teams.queueKey, { onDelete: 'cascade' }),
    reason: text('reason').notNull().default(''),
  },
  (t) => [uniqueIndex('team_links_pair_idx').on(t.sourceKey, t.targetKey)],
);

export const teamDocuments = pgTable(
  'team_documents',
  {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
      .notNull()
      .unique()
      .references(() => teams.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    embedding: vector('embedding', { dimensions: 1536 }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('team_documents_embedding_idx').using('hnsw', t.embedding.op('vector_cosine_ops')),
  ],
);

export const syncRuns = pgTable('sync_runs', {
  id: serial('id').primaryKey(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  status: text('status', { enum: ['running', 'success', 'failed'] }).notNull(),
  stats: jsonb('stats'),
  error: text('error'),
});
