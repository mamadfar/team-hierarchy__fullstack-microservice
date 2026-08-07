> **Parent:** ../../AGENTS.md (read first).
> **Maintain:** update when scoped paths, rules or conventions change.

# apps/web — Next.js frontend (:3000)

- Structure: `src/app` (layout, page, `api/sync` proxy route) · `src/components` (canvas/, chat/, sidebar/, topbar/, ui/ = vendored shadcn-style primitives) · `src/lib` (search, colors, icons, registry index, api) · `src/store/app-store.ts` (zustand) · `src/i18n` + `messages/*.json` · `src/env.ts` (zod env).
- Design fidelity is a hard requirement: tokens in `src/app/globals.css` and canvas layout constants in `src/components/canvas/layout.ts` mirror the prototype exactly — do not "improve" spacing, colors, or ranking; see [docs/agents/frontend.md](../../docs/agents/frontend.md).
- i18n: every user-visible string goes through next-intl; all four `messages/*.json` change together (unit test enforces key parity). Locale = `NEXT_LOCALE` cookie, no path prefix.
- The Refresh button calls **`/api/sync` (own server route)**, never registry `POST /sync` directly — `SYNC_APP_TOKEN` must never reach the client bundle. Client env = `NEXT_PUBLIC_*` only, validated in `src/env.ts`.
- Data: registry fetched once (TanStack Query, staleTime Infinity) → loading overlay only before first data; chat posts to `NEXT_PUBLIC_ASSISTANT_API_URL/chat` with `lang` = active locale.
- Tests: `pnpm --filter @orbit/web test` (vitest+RTL: search ranking, store, i18n parity, language menu). E2E: `test:e2e` (Playwright smoke in `e2e/`, needs the running stack; not part of `test`).
- Gotchas: `next.config.ts` must keep `output: 'standalone'` (docker) and the next-intl plugin; `public/` must exist (docker COPY); jsdom tests need the polyfills in `vitest.setup.ts`.
