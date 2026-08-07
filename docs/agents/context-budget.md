# Context budget — what to load when

Root [AGENTS.md](../../AGENTS.md) is always-on and deliberately short; everything else is opt-in. Loading discipline:

1. **Every task**: root AGENTS.md + the ONE scoped `AGENTS.md` for the package you touch (Scope routing table). Cross-package tasks: only the scoped files of packages actually touched.
2. **Only when relevant**: one topic doc from [docs/agents/README.md](README.md) ("when to read" column). Don't preload several.
3. **Code**: prefer the contract files first (`packages/shared/src/schemas.ts`, `db/schema.ts`) — they answer most "what shape is X" questions without opening service internals. Grep for symbols instead of reading whole modules.
4. **Never load**: the `orbit/` handoff (multi-thousand-line prototype) unless the task is explicitly about design fidelity; `.doc/` diagrams unless documenting or making architecture decisions; lockfiles, `dist/`, coverage output.
5. **Keep it current**: if you had to read a file to rediscover a rule that belongs in an AGENTS/topic doc, add it there (Maintaining table in root) — that's the cheapest context saving for the next agent.
