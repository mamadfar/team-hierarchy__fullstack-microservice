# Business rules

The registry's source of truth is **Confluence** (one page per company; contract in [docs/CONFLUENCE_SETUP.md](../CONFLUENCE_SETUP.md) §3). The app is strictly read-only — the only user-triggerable mutation is a re-sync.

## Invariants (violating any of these is a bug, not a style choice)
- **Queue key uniqueness across ALL companies.** A duplicate anywhere aborts the whole sync with an error naming both offending rows (company + team name). Queue keys look like `PAY-CHK` (`QueueKeySchema`).
- **Sync is all-or-nothing.** Parse + validate everything first; apply in one transaction; any failure rolls back and the previous snapshot keeps serving. A page rewritten without its config/teams tables fails loudly — the registry is never silently emptied.
- **Color/icon fallbacks are data rules**: team `hue` empty → render with the **domain** hue; unknown icon name → `box`. Both may be customized per row from Confluence (`normalizeIconName`, hue 0–360).
- **Display order = source order**: companies in `CONFLUENCE_PAGE_IDS` order; domains/tribes/teams in row order (`position` columns).
- **Links** (`Source Key | Target Key | Reason`) drive the collaboration edges; a link referencing a missing team is skipped and reported in `sync_runs.stats.rowErrors`, never fatal.
- **Sync policy**: on boot (skipped when a successful run with data exists) + manual `POST /sync` (bearer `SYNC_APP_TOKEN`, 3/min) + optional `SYNC_CRON`. History in `sync_runs` (last 10 via `GET /sync/runs`).
- **Assistant grounding**: chat answers may only reference retrieved teams; unknown queue keys are filtered server-side before the response leaves the service.
- **Team data stays in its source language** — UI chrome is localized (en/hu/fr/nl), registry content is not.
