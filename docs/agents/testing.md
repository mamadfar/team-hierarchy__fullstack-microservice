# Testing & quality

Green-only policy: a change ships only with lint + typecheck + unit tests green (`make ci` locally = what CI runs). Never commit skipped/`.only` tests. Integration suites must pass before merging backend changes; `make eval` gates assistant changes.

## Taxonomy & commands
| Layer | Where | Command | Infra |
|---|---|---|---|
| Unit (services + shared + web) | `**/__tests__/*.unit.test.ts`, `apps/web/src/__tests__` | `make test` | none |
| Integration (registry) | `src/__tests__/registry.integration.test.ts` | `make test-integration` | `make dev-infra` (pg :5433, redis :6380) |
| Integration (assistant) | `src/chat/__tests__/chat.integration.test.ts` | same | same (stubbed LLM — no key) |
| RAG eval | `apps/services/assistant-service/eval/` | `make eval` | none (seed + in-memory) — exit ≠ 0 below 90% top-3 |
| E2E smoke | `apps/web/e2e/smoke.spec.ts` | `pnpm --filter @orbit/web test:e2e` | running stack (assistant mocked via route interception) |

## Conventions
- Vitest everywhere; services use SWC configs so Nest decorators behave like the tsc build (`vitest.config.ts` unit / `vitest.integration.config.ts`).
- Integration tests own their databases: recreate (`DROP ... WITH (FORCE)` + `CREATE`) at start, boot the real `AppModule`, assert over HTTP with supertest. Pattern to copy: `registry.integration.test.ts`.
- Web: RTL + jsdom; `vitest.setup.ts` carries required polyfills (ResizeObserver, pointer capture) and explicit RTL `cleanup()` — keep both.
- Coverage: `@vitest/coverage-v8`, report-only (no failing gate); target ≥80% lines on service logic with wiring (`main.ts`, modules, DTOs, cli) excluded. Don't chase the number with assertion-free tests.
- CI (`.github/workflows/ci.yml`): always `MOCK_CONFLUENCE=true`, never real secrets, integration via pgvector/redis service containers. If you add a package, it needs `lint`/`typecheck`/`test` scripts or the root recursive run fails.
