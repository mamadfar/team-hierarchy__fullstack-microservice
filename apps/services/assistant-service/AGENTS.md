> **Parent:** ../AGENTS.md (read first — it covers both services).
> **Maintain:** update when scoped paths, rules or conventions change.

# assistant-service — RAG chat API (:4002)

- Modules: `retrieval/core/` (**framework-free**: `tokenize` w/ multilingual stopwords, `OkapiBM25`, `rrf`, `cosine`, `doc-shaper`, `hybrid`, `seed`) · `retrieval/` (Nest wiring: `IndexService`, `DocumentBuilderService`, `PgvectorSearcher`, `SyncListenerService`) · `embeddings/` (factory: `mock` default | `gemini`) · `chat/` (`ChatService` pipeline, `prompts.ts`, `answer-filter.ts`, `fallback.ts`, `llm.provider.ts`).
- **Prompts are deliverables** — treat `prompts.ts` edits like API changes: keep grounding (candidates-only), plain-text 2–4 sentences, `lang` enforcement, structured-output teams; then re-run `pnpm run eval` and keep top-3 ≥ 90%. Details: [docs/agents/assistant-rag.md](../../../docs/agents/assistant-rag.md).
- `retrieval/core/*` must stay importable without Nest/DB — `eval/run-eval.ts` runs the same code over the seed. Don't add Nest/drizzle imports there.
- No LangGraph (linear rewrite → retrieve → answer; documented in `.doc/features/assistant.md`). Service must boot and answer without `GEMINI_API_KEY` (extractive fallback) — never make the key required. Chat model default: `gemini-3.5-flash-lite`. Embeddings: `gemini-embedding-001` when `EMBEDDING_PROVIDER=gemini`.
- Never migrate the DB from this service; only `team_documents.embedding` is written here. Index rebuilds on boot + on Redis `orbit:sync:completed`.
- Commands: `test` · `test:integration` (own DB `orbit_assistant_test`, stubbed LLM) · `eval` (exit non-zero < 90% top-3).
- Gotchas: keep dropped-key filtering (`answer-filter`) — invented queue keys must never reach the UI; stopword list in `tokenize.ts` excludes signal words like "down"/"up" on purpose.
