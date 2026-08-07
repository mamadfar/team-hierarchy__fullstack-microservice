# Feature: routing assistant (RAG chat)

## What it does
`POST /chat { messages, lang }` answers "who should I send this to?" grounded in the team registry: hybrid retrieval (BM25 + pgvector, RRF fusion) picks 8 candidate teams, Claude writes a 2–4 sentence plain-text answer in the requested language and returns 1–3 queue keys as **structured output**, which the UI renders as navigable chips.

## Architecture decisions
- **No LangGraph.** The flow is strictly linear — rewrite → retrieve → answer — with no branching state to manage; ambiguity ("could be team A or B") is handled *inside* the answer prompt, not as a graph branch. LangGraph would be pure ceremony here (brief §6 explicitly demands this justification).
- **In-process BM25** (`retrieval/core/bm25.ts`, k1=1.5 b=0.75) over ~81 docs rebuilt on boot and on `orbit:sync:completed`, chosen over Postgres `ts_rank_cd`: true Okapi scoring (tf saturation + doc-length normalization) and zero DB round-trip. `search_tsv` still exists for registry-side search. Trade-off: in-memory state, mitigated by the tiny corpus and event-driven rebuilds.
- **Framework-free retrieval core** so `eval/run-eval.ts` runs the identical ranking code over the seed with no DB/Nest/LLM. Eval gate: top-3 ≥ 90% (currently **top-1 98.7%, top-3 100%** on 77 golden questions).
- **Embeddings behind LangChain's `Embeddings` interface** (`embeddings.factory.ts`): `mock` (deterministic hashed n-grams, offline default) | `voyage` | `openai` — provider swap is one env var.
- **Prompts are deliverables** (`chat/prompts.ts`): the answer prompt evolved from the prototype's `sendChat` (which used a fragile `TEAMS: KEY1, KEY2` text suffix) to candidate-scoped grounding + a structured-output tool; a separate query-rewrite prompt translates complaint language into directory language ("can't log in" → "login authentication SSO password sign-in account access").
- **Double grounding**: prompt restricts the model to the 8 candidates AND `answer-filter.ts` drops any key not in the retrieved set — an invented key cannot reach the UI.
- **Offline fallback**: without `ANTHROPIC_API_KEY` the service answers extractively (templated, localized, top-2 teams) so `make docker-up` works with zero secrets.

Real code — the fusion step ([retrieval/core/hybrid.ts](../../apps/services/assistant-service/src/retrieval/core/hybrid.ts)):

```ts
const bm25Ranked = this.bm25.search(query, this.poolSize).map((r) => r.id);

let vectorRanked: string[] = [];
if (this.vectorSearcher) {
  try {
    vectorRanked = (await this.vectorSearcher.search(query, this.poolSize)).map((r) => r.id);
  } catch {
    // Vector leg is best-effort: degrade to BM25-only (embeddings may not
    // be written yet right after a fresh boot).
    vectorRanked = [];
  }
}

const lists = vectorRanked.length > 0 ? [bm25Ranked, vectorRanked] : [bm25Ranked];
const fused = rrfFuse(lists, this.rrfK).slice(0, this.topN); // k=60, topN=8
```

## Alternatives considered
- **Vector-only retrieval**: loses exact matches on queue keys/app names, which BM25 nails; keyword-ish employee complaints are the common case.
- **One combined prompt (no rewrite step)**: saves one LLM call but follow-ups ("and who fixes that?") retrieve garbage without history resolution.
- **Chunked documents**: unnecessary — one team = one small doc; chunking would only blur team boundaries.

## Security notes
- Rate-limited per IP; input zod-validated (`ChatRequestSchema`, ≤20 messages, ≤4000 chars); logs contain question/keys but no PII fields; answer is plain text (UI renders as text, no HTML injection surface).

## Performance notes
- BM25 in-memory: sub-ms over 81 docs. pgvector HNSW cosine: ms-scale. The LLM call dominates latency; the fallback path is instant.
