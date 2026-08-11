# Registry ERD

Matches `packages/shared/src/db/schema.ts` exactly (DDL: `apps/services/registry-service/src/database/migrations/0001_init.sql`).

```mermaid
erDiagram
    companies ||--o{ domains : "company_id"
    domains ||--o{ tribes : "domain_id"
    tribes ||--o{ teams : "tribe_id"
    teams ||--o| team_documents : "team_id (unique)"
    teams ||--o{ team_links : "source_key / target_key -> queue_key"

    companies {
        serial id PK
        text slug UK
        text name
        text icon
        int hue
        text description
        text confluence_page_id
        int position
    }
    domains {
        serial id PK
        text slug UK
        int company_id FK
        text name
        int hue
        text description
        int position
    }
    tribes {
        serial id PK
        text slug UK
        int domain_id FK
        text name
        int position
    }
    teams {
        serial id PK
        text queue_key UK "e.g. PAY-CHK, unique across ALL companies"
        text name
        int tribe_id FK
        text description
        text icon
        int hue "nullable -> falls back to domain hue"
        text_arr apps
        text_arr keywords
        text channel "nullable"
        text lead "nullable"
        text oncall "nullable"
        jsonb raw
        tsvector search_tsv "weighted A/B/C, GIN index"
    }
    team_links {
        serial id PK
        text source_key FK
        text target_key FK
        text reason
    }
    team_documents {
        serial id PK
        int team_id FK "unique"
        text content "flattened team doc for RAG"
        vector_1536 embedding "HNSW cosine index, filled by assistant-service"
        timestamptz updated_at
    }
    sync_runs {
        serial id PK
        timestamptz started_at
        timestamptz finished_at "nullable"
        text status "running | success | failed"
        jsonb stats
        text error "nullable"
    }
```

- `search_tsv` is written in the sync transaction: `setweight(to_tsvector('simple', queue_key||' '||name),'A') || setweight(..keywords+apps..,'B') || setweight(..description..,'C')` with a GIN index.
- `team_documents.content` is rebuilt by registry-service on every sync; `embedding` is owned by assistant-service (mock/gemini provider).
