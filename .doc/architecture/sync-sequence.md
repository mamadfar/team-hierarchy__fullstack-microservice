# Sync sequence (boot + manual POST /sync)

Code: `apps/services/registry-service/src/sync/sync.service.ts`, `sync.repository.ts`, `sync.controller.ts`, `database/migrator.ts`.

```mermaid
sequenceDiagram
    autonumber
    participant UI as web (Refresh button)
    participant Proxy as web /api/sync (server)
    participant SC as SyncController
    participant G as ThrottlerGuard + SyncTokenGuard
    participant SS as SyncService
    participant SRC as SeedSource / ConfluenceClient+Parser
    participant SR as SyncRepository (drizzle tx)
    participant PG as Postgres
    participant R as Redis
    participant AS as assistant-service

    Note over SS: on boot: Migrator.onModuleInit ran the idempotent DDL first;<br/>boot sync skipped if a successful run with data exists

    UI->>Proxy: POST /api/sync
    Proxy->>SC: POST /sync (Authorization: Bearer SYNC_APP_TOKEN)
    SC->>G: rate limit 3/min, constant-time token check
    G-->>SC: ok (401/429 otherwise)
    SC->>SS: run('manual')
    SS->>SR: createRun() -> sync_runs(status=running)
    alt MOCK_CONFLUENCE=true
        SS->>SRC: SeedSource.load() (SEED_PATH or repo walk-up, zod-validated)
    else real Confluence
        loop each id in CONFLUENCE_PAGE_IDS (display order)
            SS->>SRC: GET /api/v2/pages/:id?body-format=storage (axios, 429 backoff)
            SRC-->>SS: parsePage(html) — cheerio, header-name matching, zod rows
        end
    end
    SS->>SS: assert unique company slugs + unique queue keys<br/>(error names BOTH offending rows)
    SS->>SR: applySnapshot(ingest) — ONE transaction
    SR->>PG: upsert companies/domains/tribes/teams,<br/>delete vanished rows, replace team_links,<br/>rebuild team_documents.content,<br/>UPDATE teams.search_tsv (setweight A/B/C)
    PG-->>SR: ApplyStats
    SS->>SR: completeRun(runId, stats)
    SS->>R: DEL orbit:registry:snapshot
    SS->>R: PUBLISH orbit:sync:completed {runId, finishedAt}
    R-->>AS: message -> rebuild BM25 index + re-embed team docs
    SC-->>Proxy: 200 {status, runId, stats}
    Proxy-->>UI: 200 -> refetch /registry, "Synced just now" toast
```

Failure at any point before `completeRun` rolls the transaction back and records `sync_runs(status=failed, error, stats.rowErrors)` — the previous snapshot keeps serving. A concurrent run is rejected with 409.
