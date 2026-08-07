# Database

One Postgres 16 + pgvector database, tables defined once in [packages/shared/src/db/schema.ts](../../packages/shared/src/db/schema.ts), DDL owned by registry-service ([0001_init.sql](../../apps/services/registry-service/src/database/migrations/0001_init.sql)). ERD: [.doc/architecture/registry-erd.md](../../.doc/architecture/registry-erd.md).

## Migration flow (schema change checklist — one change, all steps)
1. Edit the drizzle table def in `packages/shared/src/db/schema.ts`.
2. Mirror it in `0001_init.sql` **idempotently** (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`) — the `Migrator` re-runs the whole file at every boot under an advisory lock.
3. New query pattern → add the index in both places (schema def + DDL).
4. Update sync apply (`sync.repository.applySnapshot`) and snapshot assembly if the column is user-facing; update `RegistrySnapshotSchema`/`TeamSchema` in shared if it crosses the API.
5. Update the seed (`infra/db/seed/registry.json`) + `SeedFileSchema` if ingested from Confluence; extend the parser + `docs/CONFLUENCE_SETUP.md` §3 if it maps to a table column.
6. Run: shared test (seed contract), registry unit + integration, assistant integration.

## Special columns
- `teams.search_tsv` — weighted tsvector (A: queue_key+name, B: keywords+apps, C: description), GIN-indexed, written **inside the sync transaction** via `setweight(to_tsvector('simple', ...))`. Not a generated column on purpose (predictable DDL).
- `team_documents.embedding` — `vector(1536)`, HNSW cosine index. **Written only by assistant-service**; registry rebuilds `content` and leaves `embedding` untouched/null for changed rows.

## Seed & environments
- Canonical fixture: `infra/db/seed/registry.json` (generated from the prototype's `orbit/data/teams.js`; 81 teams / 3 companies / 30 links). Validated by `SeedFileSchema` in a shared unit test.
- Dev infra: `orbit-dev-*` containers, host ports **5433/6380** (`make dev-infra`). Other projects on this machine occupy 5432/6379 (some marked `prod`) — never target a database by port habit; check the container name (`docker ps`) before any `psql`/`redis-cli`.
- Integration tests recreate their own databases (`orbit_registry_test`, `orbit_assistant_test`) on the dev server — they never run against a deployed environment, and no script may default to a production DSN.
