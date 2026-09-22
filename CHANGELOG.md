# Changelog

## 0.2.5

- Add a copy/paste-ready Confluence starter page with realistic mock data for company, team, domain, and link tables.

All notable changes to Orbit. Every shipped change bumps the root `package.json` version and adds an entry here (newest first).

## 0.2.4 — 2026-08-11

- **Confluence sync error UX**: structure/parse failures and empty registry show a **Copy sample tables** action (Helix markdown matching the docs); auth/config failures (401/403/404, empty `CONFLUENCE_PAGE_IDS`, missing env) open a config checklist naming the `.env` vars and where to get page ids / API tokens — no secrets in UI. Registry Confluence HTTP errors return clearer actionable messages.

## 0.2.3 — 2026-08-11

- **Refresh rate-limit + abort**: UI Refresh disables during in-flight sync and a ~20s cooldown (aligned with registry `POST /sync` 3/min); a new Refresh aborts the prior `/api/sync` (proxy forwards `AbortSignal` upstream). Aborts and 429s toast a calm rate-limit message, not a sync failure.
- **Registry-based Ask Orbit starters**: suggested chips + placeholder hint are built from the live Confluence-synced snapshot (team names, keywords, domains); locale templates fill the copy; generic fallbacks only when the registry is empty.

## 0.2.2 — 2026-08-11

- **Chat → Explorer highlight**: assistant-recommended queue keys (`teams[]`) auto-highlight on Explorer cards (and Hierarchy tribe rows / sidebar); primary team is selected + zoomed; cleared on new question, Escape, or pane click.
- **Confluence setup docs + error UX**: README documents mandatory table structure with Helix-style examples (full SoT remains `docs/CONFLUENCE_SETUP.md`); empty registry or sync structure failures show an in-app guide with required tables + example; `/api/sync` forwards registry 422 messages to the UI.

## 0.2.1 — 2026-08-11

- **Fix `SYNC_CRON` docker-up boot**: empty `SYNC_CRON=` with an inline `#` comment was passed verbatim by Compose env-files and crashed registry; example env uses a separate comment line, scheduler ignores `#`-prefixed remnants.
- **Default chat model `gemini-3.5-flash-lite`**: `gemini-2.5-flash-lite` returns 404 for new Gemini API keys; embeddings path unchanged (`gemini-embedding-001`).

## 0.2.0 — 2026-08-11

- **Gemini-only assistant**: chat `gemini-2.5-flash-lite`, embeddings `gemini-embedding-001` (1536-d); removed Anthropic / OpenAI / Voyage paths, deps, and env vars. Offline `mock` embeddings + extractive fallback without `GEMINI_API_KEY` remain.
- **`make key NAME=… [LENGTH=32|64]`**: cryptographically secure hex secrets for `.env` / GitHub secrets.
- **Production hardening**: strong `SYNC_APP_TOKEN` required when `MOCK_CONFLUENCE=false`; production defaults `MOCK_CONFLUENCE` to false when unset; `/api/sync` CSRF (same-origin or bearer); sync PG advisory lock; index rebuild dirty-flag; Swagger disabled in production; trust proxy; web registry error/retry + sync failure toast; security headers; deploy workflow Gemini + ops vars (no localhost NEXT_PUBLIC fallbacks).

## 0.1.0 — 2026-08-07

- Initial implementation of Orbit — Team Atlas from the `orbit/` design handoff:
  - `apps/web`: Next.js 15 frontend — Explorer/Hierarchy React Flow canvas, search, detail panel, Ask Orbit chat, en/hu/fr/nl i18n, dark/light themes.
  - `apps/services/registry-service`: Confluence ingestion (storage-format table parser, 429-backoff client), registry API, sync orchestration with `sync_runs` bookkeeping, Redis snapshot cache + `orbit:sync:completed` publish, programmatic idempotent migrations, seed-based `MOCK_CONFLUENCE` mode.
  - `apps/services/assistant-service`: hybrid RAG chat (in-process BM25 + pgvector cosine, RRF fusion, Claude structured-output answers, offline extractive fallback), golden-set eval (`make eval`).
  - `packages/shared`: zod contracts, Drizzle schema, icon map.
  - `infra/` + `.github/workflows`: multi-stage Dockerfiles (node:22-alpine), full-stack + dev compose files, CI (lint/typecheck/test/integration/docker), environment-gated GHCR deploy workflow.
  - `.doc/`: architecture diagrams (context, ERD, sync + chat sequences, class diagrams) and feature docs.
