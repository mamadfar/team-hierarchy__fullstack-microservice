# Changelog

All notable changes to Orbit. Every shipped change bumps the root `package.json` version and adds an entry here (newest first).

## 0.1.0 — 2026-08-07

- Initial implementation of Orbit — Team Atlas from the `orbit/` design handoff:
  - `apps/web`: Next.js 15 frontend — Explorer/Hierarchy React Flow canvas, search, detail panel, Ask Orbit chat, en/hu/fr/nl i18n, dark/light themes.
  - `apps/services/registry-service`: Confluence ingestion (storage-format table parser, 429-backoff client), registry API, sync orchestration with `sync_runs` bookkeeping, Redis snapshot cache + `orbit:sync:completed` publish, programmatic idempotent migrations, seed-based `MOCK_CONFLUENCE` mode.
  - `apps/services/assistant-service`: hybrid RAG chat (in-process BM25 + pgvector cosine, RRF fusion, Claude structured-output answers, offline extractive fallback), golden-set eval (`make eval`).
  - `packages/shared`: zod contracts, Drizzle schema, icon map.
  - `infra/` + `.github/workflows`: multi-stage Dockerfiles (node:22-alpine), full-stack + dev compose files, CI (lint/typecheck/test/integration/docker), environment-gated GHCR deploy workflow.
  - `.doc/`: architecture diagrams (context, ERD, sync + chat sequences, class diagrams) and feature docs.
