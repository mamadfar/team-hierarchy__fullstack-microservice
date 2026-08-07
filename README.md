# Orbit — Team Atlas

Internal team-discovery and ticket-routing app. Interactive React Flow map of the whole group (companies → domains → tribes → teams), full-text search, per-team detail panel (queue key, apps, contacts), and an AI routing assistant grounded in the team registry. The registry lives in **Confluence tables** (one page per company); the app is strictly **read-only** — all edits happen in Confluence and land here on the next sync.

## Quickstart

```bash
make setup       # pnpm install + .env from .env.example
make docker-up   # full stack: web, registry, assistant, postgres(pgvector), redis
# → http://localhost:3000  (MOCK_CONFLUENCE=true: boots fully offline from the bundled seed)
```

Local development (infra in Docker, apps in watch mode):

```bash
make dev-infra && make db-migrate && make db-seed && make dev
```

All commands: `make help`.

## Layout

| Path | What |
|---|---|
| `apps/web` | Next.js (App Router) frontend — canvas, search, detail panel, chat |
| `apps/services/registry-service` | NestJS — Confluence ingestion + registry API (port 4001, Swagger at `/docs`) |
| `apps/services/assistant-service` | NestJS — RAG chat API (port 4002, Swagger at `/docs`) |
| `packages/shared` | Shared zod schemas, TS types, Drizzle table defs, icon map |
| `infra/` | Dockerfiles, compose files, DB init + seed |
| `.doc/` | Architecture diagrams (Mermaid) + feature docs |
| `docs/CONFLUENCE_SETUP.md` | How to connect the app to your company Confluence |

## Environment

Contract lives in [.env.example](.env.example) — every variable documented there; each service validates its subset with zod at boot. Key ones:

| Var | Purpose |
|---|---|
| `DATABASE_URL`, `REDIS_URL` | Postgres 16 + pgvector, Redis cache |
| `CONFLUENCE_BASE_URL` / `EMAIL` / `API_TOKEN` / `PAGE_IDS` | Read-only Confluence ingestion ([setup guide](docs/CONFLUENCE_SETUP.md)) |
| `MOCK_CONFLUENCE` | `true` = ingest from `infra/db/seed` (default in dev/CI — CI never hits real Confluence) |
| `SYNC_APP_TOKEN` | Bearer token required by `POST /sync` |
| `ANTHROPIC_API_KEY`, `LLM_MODEL` | Assistant LLM (Claude via LangChain) |
| `EMBEDDING_PROVIDER` / `MODEL` / `API_KEY` | `mock` (offline, default) / `voyage` / `openai` |
| `NEXT_PUBLIC_*` | Frontend API URLs + ticket deep-link template |

## Screenshots

_Placeholder — add after first deploy._

## Testing

```bash
make test              # unit tests, all packages
make test-integration  # services against dockerized postgres + redis
make eval              # RAG retrieval accuracy vs eval/golden.jsonl (top-3 ≥ 90% gate)
```
