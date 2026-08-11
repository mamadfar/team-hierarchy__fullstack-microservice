# System context & containers

## Context

```mermaid
graph LR
    Employee((Employee))
    Editor((Registry editor))

    subgraph Orbit
        Web["apps/web<br/>Next.js · :3000"]
        Registry["registry-service<br/>NestJS · :4001"]
        Assistant["assistant-service<br/>NestJS · :4002"]
        PG[("PostgreSQL 16<br/>+ pgvector")]
        Redis[("Redis 7<br/>cache + pub/sub")]
    end

    Confluence["Confluence Cloud<br/>(team tables, read-only)"]
    Gemini["Gemini API<br/>(chat + embeddings via LangChain)"]

    Employee -->|browser| Web
    Editor -->|edits tables| Confluence
    Web -->|"GET /registry (client)"| Registry
    Web -->|"POST /api/sync → POST /sync (server proxy, bearer)"| Registry
    Web -->|"POST /chat"| Assistant
    Registry -->|"GET /api/v2/pages/:id (basic auth)"| Confluence
    Registry --> PG
    Registry --> Redis
    Assistant --> PG
    Assistant --> Redis
    Assistant -->|answers + query rewrite| Gemini
```

- The app is **read-only**: the only mutation any user can cause is a re-sync (Refresh button). All registry edits happen in Confluence.
- `MOCK_CONFLUENCE=true` (default in dev/CI) swaps the Confluence source for the bundled seed `infra/db/seed/registry.json` — the full stack runs offline.
- Redis carries two things: the assembled snapshot cache (`orbit:registry:snapshot`) and the `orbit:sync:completed` pub/sub channel that tells assistant-service to reindex.

## Containers (docker-compose.yml)

```mermaid
graph TB
    subgraph compose [infra/docker/docker-compose.yml]
        web["web · :3000<br/>Next standalone, non-root"]
        reg["registry · :4001<br/>node dist/main.js, seed baked at /app/seed"]
        asst["assistant · :4002<br/>node dist/main.js"]
        pg[("postgres<br/>pgvector/pgvector:pg16<br/>init: infra/db/init")]
        rds[("redis:7-alpine")]
    end
    web -->|healthy| reg
    reg -->|healthy| pg
    reg -->|healthy| rds
    asst -->|healthy| pg
    asst -->|healthy| rds
```

Healthchecks gate `depends_on`; the registry migrates + boot-syncs on start, so `make docker-up` renders the seeded registry with zero manual steps. Dev variant (`docker-compose.dev.yml`) runs only postgres (host :5433) + redis (host :6380).
