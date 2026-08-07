# Assistant / RAG deep reference

Architecture: [.doc/features/assistant.md](../../.doc/features/assistant.md) + [.doc/architecture/chat-rag-sequence.md](../../.doc/architecture/chat-rag-sequence.md). This doc = how to work on it safely.

## Prompt authoring workflow (prompts are deliverables)
1. Edit `src/chat/prompts.ts` — three artifacts: rewrite system prompt, rewrite user prompt, answer system prompt. Keep the hard rules: candidates-only grounding, public name + queue key in the answer, 2–4 plain-text sentences, answer in `lang`, ambiguity → 2 closest candidates with a distinguishing clause, structured-output tool for `{answer, teams[{queueKey, confidence}]}`.
2. Prompt unit tests (`__tests__/prompts.unit.test.ts`) pin the rules' presence — update them WITH the prompt, never delete assertions to make an edit pass.
3. Run `pnpm --filter @orbit/assistant-service run eval` — retrieval-only gate, must stay ≥90% top-3 (currently 100%). If your change is answer-side only, eval still guards against accidental retrieval edits.
4. Server-side key filtering (`answer-filter.ts`) stays regardless of prompt quality — defense in depth.

## Retrieval tuning
- Order of levers: doc shaping (`core/doc-shaper.ts` — what text BM25 sees) → tokenizer stopwords (`core/tokenize.ts` — function words only; NEVER stopword signal words like "down", "failed") → BM25 params (k1/b) → RRF k / pool sizes (`core/hybrid.ts`: pool 24, topN 8, k 60).
- Add golden questions (`eval/golden.jsonl`, `{"q", "expect": [keys]}`) for every routing bug you fix — phrase like humans complain, don't copy keyword strings.
- The vector leg is best-effort (degrades to BM25-only when embeddings aren't written yet); keep that try/catch.

## Embeddings
Factory (`embeddings/embeddings.factory.ts`): `mock` (deterministic hashed n-grams, offline default — dev/CI must never need a key) | `voyage` | `openai`; model/key from env. Embeddings are written to `team_documents.embedding` on boot and on `orbit:sync:completed`. If you add a provider: wire it through the LangChain `Embeddings` interface and extend the env enum + `.env.example`.

## Logging & privacy
Log per chat: question, rewritten query, retrieved keys, answered keys — never add user identifiers or headers to these logs.
