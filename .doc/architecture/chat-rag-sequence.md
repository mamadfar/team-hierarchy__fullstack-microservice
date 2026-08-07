# Chat / RAG sequence (POST /chat)

Code: `apps/services/assistant-service/src/chat/chat.service.ts`, `retrieval/*`, `chat/prompts.ts`, `chat/answer-filter.ts`, `chat/fallback.ts`.

```mermaid
sequenceDiagram
    autonumber
    participant UI as web chat panel
    participant CC as ChatController (throttled per IP)
    participant CS as ChatService
    participant LLM as Claude via LangChain
    participant RET as RetrievalService
    participant BM as OkapiBM25 (in-memory)
    participant PV as PgvectorSearcher
    participant PG as Postgres (team_documents)

    UI->>CC: POST /chat { messages, lang } (zod: ChatRequestSchema)
    CC->>CS: chat(request)
    alt ANTHROPIC_API_KEY set
        CS->>LLM: query-rewrite prompt (history + last message)
        LLM-->>CS: standalone lexical query with synonyms
    else no key
        CS->>CS: use raw last user message as query
    end
    par hybrid retrieval
        CS->>RET: retrieve(query, topK=8)
        RET->>BM: search(query) — k1=1.5 b=0.75, stopworded tokens
        RET->>PV: embed(query) -> ORDER BY embedding <=> $1 (cosine)
        PV->>PG: SELECT ... LIMIT n
    end
    RET-->>CS: Reciprocal Rank Fusion (k=60) -> top 8 teams
    alt LLM available
        CS->>LLM: answer prompt (candidates ONLY, lang, 2–4 plain-text sentences)<br/>structured output tool {answer, teams[{queueKey, confidence}]}
        LLM-->>CS: draft
        CS->>CS: answer-filter: drop any key NOT in the retrieved set
    else fallback (offline/CI)
        CS->>CS: templated extractive answer in `lang` from top-2 retrieved teams
    end
    CS-->>CC: { answer: plain text, teams: [{queueKey, name, confidence}] }
    CC-->>UI: 200 -> bubble + team chips (chip click zooms the map)
    Note over CS: logs: question, rewritten query, retrieved keys, answered keys (no PII)
```

Grounding is enforced twice: the prompt scopes the model to the 8 retrieved candidates, and `answer-filter` drops any queue key the retriever did not produce — an invented key can never reach the UI.
