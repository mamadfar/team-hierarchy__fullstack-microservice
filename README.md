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
| `MOCK_CONFLUENCE` | `true` = ingest from `infra/db/seed` (default in dev/CI — CI never hits real Confluence). Unset in production defaults to `false`. |
| `SYNC_APP_TOKEN` | Bearer token required by `POST /sync` (and authorized `/api/sync`). Generate: `make key NAME=SYNC_APP_TOKEN` |
| `GEMINI_API_KEY`, `LLM_MODEL` | Assistant LLM (Gemini via LangChain; default model `gemini-3.5-flash-lite`) |
| `EMBEDDING_PROVIDER` / `EMBEDDING_MODEL` | `mock` (offline, default) / `gemini` (`gemini-embedding-001`, needs `GEMINI_API_KEY`) |
| `NEXT_PUBLIC_*` | Frontend API URLs + ticket deep-link template |
| `REGISTRY_API_URL` | Web server-only registry URL for the sync proxy (docker: `http://registry:4001`) |

Generate secrets locally:

```bash
make key NAME=SYNC_APP_TOKEN          # 64 hex chars (default)
make key NAME=SYNC_APP_TOKEN LENGTH=32
```

## Confluence page layout (mandatory)

Orbit ingests **one Confluence page per company**. Full contract, auth setup, and troubleshooting: **[docs/CONFLUENCE_SETUP.md](docs/CONFLUENCE_SETUP.md)** (single source of truth). Summary:

| Table | Required? | What |
|---|---|---|
| **Company config** | Yes | Key/Value rows; at least **Name**. Optional: Icon, Color (hue 0–360), Description. |
| **Teams** | Yes | Headers must include **Team Name** + **Queue Key** (also **Tribe** + **Domain**). Optional: Description, Applications, Keywords, Icon, Color, Channel, Team Lead, On-call. |
| **Domains** | Optional | Name \| Color \| Description — per-domain hues. |
| **Links** | Optional | Source Key \| Target Key \| Reason — collaboration edges on the map. |

Rules:
- Headers are matched **by name** (case-insensitive), not column order.
- **Queue Key** format like `HLX-CHK` — **unique across all companies** (duplicates fail sync naming both rows).
- **Icon** = supported icon name; **Color** = hue 0–360 (optional; team color falls back to domain).
- One page id per company in `CONFLUENCE_PAGE_IDS` (order = display order).
- Missing config/teams tables or required columns → sync **422** with a clear message; the UI shows this guide instead of an empty map. Previous snapshot stays live on failure.
- **Refresh** (UI) is client rate-limited (~20s cooldown) and aborts an in-flight sync if another starts; registry `POST /sync` remains throttled at **3/min** (bearer `SYNC_APP_TOKEN`).

### Starter page (mock data — copy into Confluence, then replace)

Paste the following tables into a new Confluence page. The values are intentionally fictional but demonstrate the expected structure and relationships.

**Copy area**

```text
Company config

| Key | Value |
|---|---|
| Name | Northstar Labs |
| Icon | building |
| Color | 205 |
| Description | Software products, developer tooling, and platform operations. |

Teams

| Team Name | Queue Key | Tribe | Domain | Description | Applications | Keywords | Icon | Color | Channel | Team Lead | On-call |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Developer Experience | NSL-DXP | Product Engineering | Engineering | Tooling and workflows that help teams ship software. | Dev Portal, Buildkite | local setup, CI pipeline | code | 190 | #nsl-devex | Priya Shah | nsl-devex-oncall |
| Identity Platform | NSL-IDP | Core Services | Platform | Authentication, authorization, and account lifecycle. | Identity API, Admin Console | login, permissions, SSO | lock | 225 | #nsl-identity | Mateo Ruiz | nsl-identity-oncall |
| Observability | NSL-OBS | Core Services | Platform | Metrics, logs, traces, and production health. | Grafana, Alertmanager | alert, dashboard, incident | activity | 245 | #nsl-observability | Erin Cole | nsl-observability-oncall |

Domains

| Name | Color | Description |
|---|---|---|
| Engineering | 190 | Product development and developer productivity. |
| Platform | 235 | Shared services and operational foundations. |

Links

| Source Key | Target Key | Reason |
|---|---|---|
| NSL-DXP | NSL-IDP | Developer tools use platform identity and access controls. |
| NSL-OBS | NSL-IDP | Identity service telemetry is monitored by Observability. |
```

**Company config**

| Key | Value |
|---|---|
| Name | Northstar Labs |
| Icon | building |
| Color | 205 |
| Description | Software products, developer tooling, and platform operations. |

**Teams**

| Team Name | Queue Key | Tribe | Domain | Description | Applications | Keywords | Icon | Color | Channel | Team Lead | On-call |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Developer Experience | NSL-DXP | Product Engineering | Engineering | Tooling and workflows that help teams ship software. | Dev Portal, Buildkite | local setup, CI pipeline | code | 190 | #nsl-devex | Priya Shah | nsl-devex-oncall |
| Identity Platform | NSL-IDP | Core Services | Platform | Authentication, authorization, and account lifecycle. | Identity API, Admin Console | login, permissions, SSO | lock | 225 | #nsl-identity | Mateo Ruiz | nsl-identity-oncall |
| Observability | NSL-OBS | Core Services | Platform | Metrics, logs, traces, and production health. | Grafana, Alertmanager | alert, dashboard, incident | activity | 245 | #nsl-observability | Erin Cole | nsl-observability-oncall |

**Domains** (optional)

| Name | Color | Description |
|---|---|---|
| Engineering | 190 | Product development and developer productivity. |
| Platform | 235 | Shared services and operational foundations. |

**Links** (optional)

| Source Key | Target Key | Reason |
|---|---|---|
| NSL-DXP | NSL-IDP | Developer tools use platform identity and access controls. |
| NSL-OBS | NSL-IDP | Identity service telemetry is monitored by Observability. |

Set `MOCK_CONFLUENCE=false` and `CONFLUENCE_PAGE_IDS=<your page id>` after the pages exist. Offline/dev without Confluence: keep `MOCK_CONFLUENCE=true` (bundled seed).

## Screenshots

_Placeholder — add after first deploy._

## Testing

```bash
make test              # unit tests, all packages
make test-integration  # services against dockerized postgres + redis
make eval              # RAG retrieval accuracy vs eval/golden.jsonl (top-3 ≥ 90% gate)
```
