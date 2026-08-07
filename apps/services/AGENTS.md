> **Parent:** ../../AGENTS.md (read first).
> **Maintain:** update when scoped paths, rules or conventions change.

# apps/services — shared backend concerns

- Two NestJS 11 services, one Postgres database. Class-based `Controller → Service → Repository`, Nest DI; no free-floating function modules as the main unit.
- **Schema ownership**: table defs live in `@orbit/shared/db`; **registry-service owns DDL/migrations** (`src/database/migrations/0001_init.sql`, run by its boot `Migrator`). assistant-service reads tables + writes only `team_documents.embedding` — it must never migrate. Details: [docs/agents/database.md](../../docs/agents/database.md).
- **Sync fan-out contract**: registry publishes Redis `orbit:sync:completed` after a successful sync (and busts `orbit:registry:snapshot`); assistant subscribes and reindexes. Change either side → change both + their tests.
- HTTP out: axios via each service's `HttpClient` class only (timeouts, AppError mapping, 429/5xx backoff). Never `fetch` on the backend.
- Errors: throw `AppError(status, message)`; the global `AllExceptionsFilter` renders `{ status, message }` (stack only in development). Env: zod-validated at boot, crash fast.
- Swagger at `/docs` on both; helmet + CORS restricted to `WEB_ORIGIN`; throttlers on mutating/expensive routes.
- Local infra: `make dev-infra` → `orbit-dev-*` containers, host ports **5433 (pg) / 6380 (redis)** — chosen to avoid other projects' 5432/6379 on this machine. Integration tests create their own databases (`orbit_registry_test`, `orbit_assistant_test`).
- Docker runtime contract per service: `dist/main.js`, `GET /health`, binds 0.0.0.0, `@orbit/shared` in `dependencies` (not dev).
