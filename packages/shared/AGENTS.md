> **Parent:** ../../AGENTS.md (read first).
> **Maintain:** update when scoped paths, rules or conventions change.

# packages/shared — contracts (zod + drizzle + icons)

- Exports: `@orbit/shared` (zod schemas + inferred types in `src/schemas.ts`, icon map in `src/icons.ts`) and `@orbit/shared/db` (drizzle tables in `src/db/schema.ts`). CommonJS build; consumers resolve the subpath via both `exports` and `typesVersions` — keep both in `package.json`.
- **Contract-first**: every change here ripples into both services and the web app. Changing a schema ⇒ check registry snapshot assembly, sync validation, assistant DTOs, web types, and the seed fixture — in the same change.
- Drizzle table defs must stay in lockstep with `apps/services/registry-service/src/database/migrations/0001_init.sql` (registry owns the DDL; this package owns the types).
- No app-specific code here: no Nest, no React, no env reads. zod + drizzle-orm only.
- The seed test (`src/__tests__/schemas.unit.test.ts`) validates `infra/db/seed/registry.json` against `SeedFileSchema` — regenerate or hand-edit the seed and this test tells you if you broke the contract.
- Build before dependents in fresh clones: `pnpm --filter @orbit/shared run build` (CI does this explicitly).
