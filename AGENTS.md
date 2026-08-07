# AGENTS.md — Orbit (single source of truth for AI coding agents)

## What this is
Orbit — Team Atlas: internal team-discovery + ticket-routing app. React Flow map of companies → domains → tribes → teams, search, detail panel, RAG routing assistant. **Read-only**: registry data is edited in Confluence, ingested by registry-service.
Stack: pnpm workspace · Next.js 15 (`apps/web`, :3000) · NestJS 11 (`apps/services/registry-service` :4001, `apps/services/assistant-service` :4002) · Postgres 16 + pgvector (:5433 dev) · Redis (:6380 dev). Run: `make setup && make docker-up` (offline via `MOCK_CONFLUENCE=true`).

## Scope routing
Read this file first, then ONLY the scoped file for the package you touch. Do not load other scoped files unless the task crosses packages.

| Working in | Read next |
|---|---|
| `apps/web/**` | [apps/web/AGENTS.md](apps/web/AGENTS.md) |
| `apps/services/**` (either service) | [apps/services/AGENTS.md](apps/services/AGENTS.md) |
| `apps/services/registry-service/**` | + [its AGENTS.md](apps/services/registry-service/AGENTS.md) |
| `apps/services/assistant-service/**` | + [its AGENTS.md](apps/services/assistant-service/AGENTS.md) |
| `packages/shared/**` | [packages/shared/AGENTS.md](packages/shared/AGENTS.md) |
| `infra/**`, `.github/**`, env vars | [docs/agents/env-and-secrets.md](docs/agents/env-and-secrets.md) |

## Locate code
Grep/glob from the repo root; source lives only in `apps/*/src`, `packages/shared/src`, `infra/`, `.github/`. `orbit/` is the gitignored design handoff (reference only — never edit). API/data contracts: `packages/shared/src/schemas.ts`. DB tables: `packages/shared/src/db/schema.ts`. Architecture diagrams: `.doc/architecture/`.

## Token efficiency
Agent-facing prose (AGENTS files, plans, PR descriptions to agents): terse. Code, comments, commit messages, and user-facing copy: normal, complete language.

## Agent conduct
Bias caution over speed on non-trivial work; use judgment on trivial tasks. Full detail: [docs/agents/agent-conduct.md](docs/agents/agent-conduct.md).

- **Guardrail — >90% confidence.** Don't present a guess as fact; below 90% investigate, ask, or state the uncertainty. "I don't know" beats a confident wrong answer.
- **Raise incidental bugs** found during any task at the end; never silently work around them.
- **Brutal honesty.** If the user is wrong, say so and why; separate fact from opinion; disagree early on bad plans.
- **Think before coding.** State assumptions; present multiple interpretations; never implement on a guess.
- **Simplicity first.** Minimum code that solves the problem; no unrequested features/abstractions/flexibility.
- **Surgical diffs.** Touch only what the task needs; match existing style; every changed line traces to the request.
- **Goal-driven execution.** Every request gets a verifiable success criterion (repro → fix → green).
- **Better paths.** Name clearly-stronger alternatives with trade-offs (1–2 options); user decides.
- **Performance & security.** Flag DB/API/bundle issues from the code path, not hypothetically; never trade safety for convenience.
- **Task wrap-up.** Say **done** when finished; **Decision** / **Warning** sections only when non-empty; if blocked, don't say done.

## Non-negotiables (every change)
1. Plan first in a gitignored `plans/plan-*.md`; wait for approval before coding.
2. Version bump (root `package.json`) + [CHANGELOG.md](CHANGELOG.md) entry on every shipped change.
3. i18n: never hardcode user-facing strings in `apps/web`; update **all four** locale files (`apps/web/messages/{en,hu,fr,nl}.json`) in the same change (a unit test enforces key parity).
4. New/changed API endpoint → Swagger-annotated DTO, registered in the service's module, CORS/throttle reviewed, **and** an integration test covering success + auth + validation + error paths.
5. DB schema change → update `packages/shared/src/db/schema.ts` **and** `apps/services/registry-service/src/database/migrations/0001_init.sql` (idempotent DDL) **and** an index for any new query pattern. Details: [docs/agents/database.md](docs/agents/database.md).
6. Security: never bypass `SyncTokenGuard` or the throttlers on `/sync` and `/chat`; the sync token stays server-side (web proxies via `/api/sync`).
7. New env var → same-change checklist in [docs/agents/env-and-secrets.md](docs/agents/env-and-secrets.md) (`.env.example`, both env schemas if shared, compose files, Dockerfiles, `ci.yml`/`deploy.yml`, README table).
8. **Dev vs production data:** default to never touching production. Any command/script/test that writes to or deletes from a database must state its target env and be guarded. This machine runs look-alike containers from other projects (`plinth-prod-*`, `rahyab-dev-*`) — a bare `docker exec db psql` is not environment-safe; Orbit dev infra is `orbit-dev-*` on host ports **5433/6380**. Never point a test suite at a deployed environment.
9. Local-only paths → add to `.gitignore` **and** the relevant `.dockerignore` in the same change.
10. **No AI attribution in commits:** no `Co-authored-by`, no agent `Signed-off-by`, no "Generated with …", no tool footers. Author = the human git identity only.

## Business rules (summary)
Registry is read-only in-app; queue keys are unique across ALL companies (sync fails naming both rows); team icon/hue come from Confluence with fallback to domain hue; sync is all-or-nothing per run (previous snapshot survives failures). Full detail: [docs/agents/business-rules.md](docs/agents/business-rules.md).

## Testing & quality
Before commit: `make lint && make typecheck && make test` (green-only; no skipped tests left behind). Integration: `make test-integration` (needs `make dev-infra`). RAG gate: `make eval` must stay ≥90% top-3. Full taxonomy: [docs/agents/testing.md](docs/agents/testing.md).

## Topic docs (do not load every turn)
| Doc | Read when |
|---|---|
| [docs/agents/agent-conduct.md](docs/agents/agent-conduct.md) | conduct question / dispute |
| [docs/agents/database.md](docs/agents/database.md) | schema, migrations, seed, search_tsv, pgvector |
| [docs/agents/testing.md](docs/agents/testing.md) | writing/fixing tests, CI failures |
| [docs/agents/business-rules.md](docs/agents/business-rules.md) | sync semantics, registry invariants |
| [docs/agents/frontend.md](docs/agents/frontend.md) | design tokens, canvas, i18n, a11y |
| [docs/agents/assistant-rag.md](docs/agents/assistant-rag.md) | prompts, retrieval, eval |
| [docs/agents/env-and-secrets.md](docs/agents/env-and-secrets.md) | env vars, secrets, deploy |
| [docs/agents/context-budget.md](docs/agents/context-budget.md) | what to load when |

## Quick commands
```bash
make setup            # install + .env
make dev-infra && make dev   # local watch mode (pg :5433, redis :6380)
make docker-up        # full stack, zero manual steps (MOCK_CONFLUENCE=true)
make test             # unit tests, all packages
make eval             # RAG retrieval gate (top-3 >= 90%)
```

## Planning workflow
1. Explore; write `plans/plan-<task>.md` (gitignored): goal, files to touch, per-step verification.
2. Wait for explicit approval.
3. Implement step-by-step, checking off the plan; keep diffs surgical.
4. Verify (tests/lint/typecheck green, plus the step's named verification) before saying **done**.

## Maintaining agent docs
| Change | Edit |
|---|---|
| Cross-project rule / command / port | this file (keep it short — move detail to a topic doc) |
| Package-specific delta (structure, gotcha, test cmd) | that package's `AGENTS.md` |
| Deep detail (schema flow, prompt authoring, env checklist) | `docs/agents/<topic>.md` (+ its README row) |
| New package | new scoped `AGENTS.md` + a Scope-routing row here |

## Multi-tool setup
| Tool | Reads |
|---|---|
| Claude Code | `CLAUDE.md` (stub) → this file |
| Cursor / Copilot / Codex / Antigravity | `AGENTS.md` natively (root + nearest scoped) |

One source of truth: no `.cursorrules`, no `.github/copilot-instructions.md`, no nested `CLAUDE.md` beyond the root stub.
