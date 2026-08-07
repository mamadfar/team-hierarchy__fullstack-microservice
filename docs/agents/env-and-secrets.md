# Env vars & secrets

Contract: [.env.example](../../.env.example) (documented, validated by zod at each boot — registry `src/config/env.ts`, assistant `src/config/env.ts`, web `src/env.ts`).

## New env var — same-change checklist
1. `.env.example` (with a comment; empty default for secrets).
2. The consuming package's zod env schema (+ its unit expectations if any).
3. `infra/docker/docker-compose.yml` (passthrough `${VAR:-default}`) and, if dev-relevant, `docker-compose.dev.yml`.
4. The service's Dockerfile **only** if it needs a baked default (like `SEED_PATH`); never bake secrets.
5. `.github/workflows/ci.yml` if tests need it (non-secret values only) and `deploy.yml` env-injection block if production needs it.
6. README env table + [docs/CONFLUENCE_SETUP.md](../CONFLUENCE_SETUP.md) if Confluence-related.
7. `NEXT_PUBLIC_*` prefix **only** for values safe in the browser bundle — everything else is server-side (the web sync proxy pattern exists exactly because `SYNC_APP_TOKEN` must not ship to clients).

## Secrets policy
- Secrets live in env only: never in code, compose files, Dockerfiles, images, logs, or test fixtures. CI runs entirely with `MOCK_CONFLUENCE=true` and zero real secrets.
- Production injection: GitHub Actions secrets → `deploy.yml` runtime env (`CONFLUENCE_BASE_URL/EMAIL/API_TOKEN/PAGE_IDS`, `ANTHROPIC_API_KEY`, `DATABASE_URL`, `REDIS_URL`, `SYNC_APP_TOKEN`). Setup commands: [docs/CONFLUENCE_SETUP.md](../CONFLUENCE_SETUP.md) §6. Public web build args come from GitHub **Variables**, not secrets.
- Confluence token: read-only service account, one space, rotate quarterly (= update one GitHub secret + redeploy).

## Environment safety
- Compose reads the **invoking shell**, not the repo `.env` automatically — the Makefile passes `--env-file .env` when it exists.
- Local ports: web 3000 · registry 4001 · assistant 4002 · dev pg **5433** · dev redis **6380**. This machine hosts other projects' containers on 5432/6379 (incl. `*-prod-*` names) — verify container names before any direct DB command; never run destructive commands against a database you didn't start.
