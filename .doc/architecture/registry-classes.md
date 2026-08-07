# registry-service — core classes

```mermaid
classDiagram
    direction LR

    class RegistryController {
        +getRegistry() RegistrySnapshot
        +getTeam(queueKey) Team
        +getSyncRuns() SyncRun[]
        +getHealth() HealthStatus
    }
    class RegistryService {
        -env Env
        -repository RegistryRepository
        -redis Redis
        +getSnapshot() RegistrySnapshot
        +getTeamByQueueKey(key) Team
        +getSyncRuns() SyncRun[]
        +getHealth() HealthStatus
        -assembleSnapshot()
        -readCache() / writeCache()
    }
    class RegistryRepository {
        -db Db (drizzle)
        +findCompanies() / findDomains() / findTribes()
        +findTeams() / findLinks()
        +findTeamByQueueKey(key)
        +findRecentSyncRuns(n)
        +findLastSuccessfulSync()
        +pingDb()
    }

    class SyncController {
        +trigger() SyncTriggerResponseDto
    }
    class SyncTokenGuard {
        +canActivate(ctx) bool
        -matches(provided, expected) "sha256 + timingSafeEqual"
    }
    class SyncService {
        -running bool
        +onApplicationBootstrap() "boot sync policy"
        +run(trigger) SyncResult
        -loadFromConfluence()
        -assertUniqueQueueKeys()
        -assertUniqueCompanySlugs()
        -afterSuccess() "cache bust + publish"
    }
    class SyncRepository {
        +createRun() / completeRun() / failRun()
        +hasSuccessfulRunWithData()
        +applySnapshot(ingest) ApplyStats "one tx: upserts, tsv, team_documents"
    }
    class SyncScheduler {
        +onModuleInit() "registers SYNC_CRON job when set"
    }
    class SeedSource {
        +load() ParsedRegistry "SEED_PATH or repo walk-up, zod"
    }

    class ConfluenceClient {
        +getPageStorage(pageId) ConfluencePage
    }
    class ConfluencePageParser {
        +parsePage(html, meta) "cheerio; config/teams/domains/links tables"
    }
    class HttpClient {
        +get(url, config)
        -handleError() "429/5xx retry, backoff+jitter, Retry-After"
        -toAppError()
    }

    class Migrator {
        +onModuleInit()
        +run() "advisory lock + idempotent DDL"
    }
    class AllExceptionsFilter {
        +catch(exception, host) "{ status, message }, stack only in dev"
    }
    class AppError {
        +status number
        +details unknown[]
    }

    RegistryController --> RegistryService
    RegistryService --> RegistryRepository
    SyncController --> SyncService
    SyncController ..> SyncTokenGuard
    SyncService --> SeedSource
    SyncService --> ConfluenceClient
    SyncService --> ConfluencePageParser
    SyncService --> SyncRepository
    SyncScheduler --> SyncService
    ConfluenceClient --> HttpClient
    AllExceptionsFilter ..> AppError
```
