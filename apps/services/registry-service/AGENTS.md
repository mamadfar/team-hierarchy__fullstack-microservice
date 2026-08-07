> **Parent:** ../AGENTS.md (read first — it covers both services).
> **Maintain:** update when scoped paths, rules or conventions change.

# registry-service — Confluence ingestion + registry API (:4001)

- Modules: `config/` (zod env) · `database/` (pg pool, drizzle, `Migrator` + `migrations/0001_init.sql`, `sql-splitter`) · `confluence/` (`HttpClient`, `ConfluenceClient` — v2 `pages/:id?body-format=storage`, `ConfluencePageParser` — cheerio, header-NAME matching) · `registry/` (API + Redis-cached snapshot assembly) · `sync/` (`SyncService` orchestration, `SyncRepository` single-tx apply, `SyncTokenGuard`, `SyncScheduler`, `SeedSource`).
- Sync invariants you must preserve: duplicate queue key across pages fails naming BOTH rows; missing config/teams table fails loudly; apply is one transaction (rollback keeps previous snapshot); `search_tsv` written in-tx; `team_documents.content` rebuilt but `embedding` left alone; success → cache bust + `orbit:sync:completed` publish. Boot sync skipped when a successful run with data exists.
- Confluence page contract lives in [docs/CONFLUENCE_SETUP.md](../../../docs/CONFLUENCE_SETUP.md) §3 — parser changes must stay in lockstep with that doc.
- `MOCK_CONFLUENCE=true` (default): `SeedSource` reads `SEED_PATH` or walks up to `infra/db/seed/registry.json`.
- Schema change flow: edit `@orbit/shared/db` schema + `0001_init.sql` together (DDL is idempotent — additive `IF NOT EXISTS`/`ADD COLUMN IF NOT EXISTS`).
- Commands: `test` (unit, coverage) · `test:integration` (real pg+redis; recreates `orbit_registry_test`) · `db:migrate` · `db:seed` · `dev`.
- Gotchas: migration .sql ships to `dist` via `nest-cli.json` assets — keep that block; `parseEnv` treats empty strings as unset; POST /sync throttle is 3/min (integration test consumes the whole window).
