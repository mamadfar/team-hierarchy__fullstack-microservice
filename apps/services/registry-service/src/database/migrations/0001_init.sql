-- Orbit registry schema. Idempotent, hand-written DDL matching
-- packages/shared/src/db/schema.ts exactly. Executed by the Migrator at boot
-- and by `pnpm run db:migrate`.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS companies (
  id serial PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  icon text NOT NULL,
  hue integer NOT NULL,
  description text NOT NULL DEFAULT '',
  confluence_page_id text NOT NULL,
  position integer NOT NULL
);

CREATE TABLE IF NOT EXISTS domains (
  id serial PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  hue integer NOT NULL,
  description text NOT NULL DEFAULT '',
  position integer NOT NULL
);

CREATE TABLE IF NOT EXISTS tribes (
  id serial PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  domain_id integer NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  name text NOT NULL,
  position integer NOT NULL
);

CREATE TABLE IF NOT EXISTS teams (
  id serial PRIMARY KEY,
  queue_key text NOT NULL UNIQUE,
  name text NOT NULL,
  tribe_id integer NOT NULL REFERENCES tribes(id) ON DELETE CASCADE,
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
);

CREATE INDEX IF NOT EXISTS teams_search_tsv_idx ON teams USING gin (search_tsv);

CREATE TABLE IF NOT EXISTS team_links (
  id serial PRIMARY KEY,
  source_key text NOT NULL REFERENCES teams(queue_key) ON DELETE CASCADE,
  target_key text NOT NULL REFERENCES teams(queue_key) ON DELETE CASCADE,
  reason text NOT NULL DEFAULT ''
);

CREATE UNIQUE INDEX IF NOT EXISTS team_links_pair_idx ON team_links (source_key, target_key);

CREATE TABLE IF NOT EXISTS team_documents (
  id serial PRIMARY KEY,
  team_id integer NOT NULL UNIQUE REFERENCES teams(id) ON DELETE CASCADE,
  content text NOT NULL,
  embedding vector(1536),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS team_documents_embedding_idx
  ON team_documents USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS sync_runs (
  id serial PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL,
  stats jsonb,
  error text
);
