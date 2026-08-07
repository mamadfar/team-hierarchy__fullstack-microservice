# Feature: Confluence sync

## What it does
Ingests the team registry from Confluence Cloud pages (one page per company, two+ tables per page — contract in [docs/CONFLUENCE_SETUP.md](../../docs/CONFLUENCE_SETUP.md)) into Postgres, on boot / on the UI Refresh button (`POST /sync`) / optionally on `SYNC_CRON`. With `MOCK_CONFLUENCE=true` the source is the bundled seed instead — same pipeline, fully offline.

## Architecture decisions
- **Header-name table parsing, not position** (`confluence-page.parser.ts`): columns are matched case-insensitively by header text, so editors can reorder columns in Confluence without breaking the sync. Macros/status/emoji elements are stripped to plain text.
- **All-or-nothing transaction**: parse + validate everything first, then apply in one drizzle transaction (`sync.repository.applySnapshot`). A partial failure leaves the previous snapshot intact — the parser "fails loudly, never silently empties the registry".
- **Cross-page invariants before the tx**: duplicate queue keys across ALL companies abort the sync with an error naming both offending rows (`sync.service.assertUniqueQueueKeys`).
- **Programmatic idempotent migrations** (`database/migrator.ts` + `0001_init.sql`, advisory-lock guarded) instead of drizzle-kit at runtime — containers boot with zero manual steps.
- **Fan-out via Redis pub/sub**: after success the registry busts `orbit:registry:snapshot` and publishes `orbit:sync:completed`; assistant-service reindexes independently. No cross-service HTTP coupling.

Real code — the retry-safe Confluence HTTP layer (`http-client.ts`):

```ts
if (config && status !== undefined && RETRYABLE_STATUSES(status)) {
  const attempt = config.__attempt ?? 1;
  if (attempt < this.maxAttempts) {
    config.__attempt = attempt + 1;
    await this.sleep(this.retryDelay(attempt, error)); // exp backoff + jitter, honors Retry-After on 429
    return this.instance.request(config);
  }
}
throw this.toAppError(error);
```

## Alternatives considered
- **Webhook-push instead of pull**: Confluence Automation "page updated → send web request" gives near-real-time sync without polling. Kept as an optional add-on (docs §7) because pull-on-boot + manual refresh already meets the freshness requirement with far less setup.
- **drizzle-kit push for migrations**: less duplication, but needs dev tooling in the runtime image and its DDL for `tsvector`/HNSW is less predictable than 60 lines of hand-written idempotent SQL.
- **Diff-only upserts vs full replace**: full upsert + delete-vanished inside one tx is simpler and the dataset is tiny (~81 teams); a row-level diff would only matter at 100× scale.

## Security notes
- `POST /sync` = `ThrottlerGuard` (3/min) + `SyncTokenGuard` (bearer, sha256 + `timingSafeEqual`). The token never reaches the browser — the web app proxies through its own server route.
- Confluence credentials are a read-only service-account token, env-only, never logged.

## Performance notes
- Snapshot served from Redis (`EX 3600`, busted on sync); a cold assemble is 6 parallel reads over indexed tables.
- `search_tsv` (weighted A/B/C + GIN) is written in-transaction — no post-sync reindex step.
