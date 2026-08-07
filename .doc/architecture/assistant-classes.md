# assistant-service — core classes

```mermaid
classDiagram
    direction LR

    class ChatController {
        +chat(body) ChatResponse "throttled per IP"
    }
    class ChatService {
        +chat(request) ChatResponse
        -rewriteQuery() "LLM or raw fallback"
        -answer() "structured output or extractive fallback"
    }
    class RoutingLlm {
        <<provider LLM>>
        +rewrite(system, user) string
        +answer(system, schema) AnswerDraft
    }
    class prompts {
        <<module>>
        +buildRewriteSystemPrompt()
        +buildRewriteUserPrompt(messages)
        +buildAnswerSystemPrompt(lang, teams)
        +sanitizeRewrittenQuery(raw, fallback)
    }
    class answerFilter {
        <<module>>
        +filterToRetrieved(draft, retrieved) "drops invented keys"
    }
    class fallback {
        <<module>>
        +extractiveAnswer(lang, teams) "offline/CI answers"
    }

    class RetrievalService {
        +retrieve(query, topK=8) RetrievedTeam[]
    }
    class IndexService {
        +rebuild() "docs from DB -> BM25 + embeddings"
        +ready bool
    }
    class DocumentBuilderService {
        +loadDocs() "team_documents JOIN teams"
    }
    class OkapiBM25 {
        +index(docs)
        +search(query, limit) RankedResult[]
    }
    class rrf {
        <<module>>
        +fuse(lists, k=60)
    }
    class PgvectorSearcher {
        +search(query, limit) "embedding <=> cosine"
    }
    class EmbeddingsFactory {
        +create(env) Embeddings "mock | voyage | openai"
    }
    class MockEmbeddings {
        +embedQuery / embedDocuments "deterministic 1536-dim, offline"
    }
    class SyncListenerService {
        +onApplicationBootstrap() "SUBSCRIBE orbit:sync:completed"
    }

    ChatController --> ChatService
    ChatService --> RoutingLlm
    ChatService ..> prompts
    ChatService ..> answerFilter
    ChatService ..> fallback
    ChatService --> RetrievalService
    RetrievalService --> OkapiBM25
    RetrievalService --> PgvectorSearcher
    RetrievalService ..> rrf
    IndexService --> DocumentBuilderService
    IndexService --> OkapiBM25
    IndexService --> EmbeddingsFactory
    EmbeddingsFactory --> MockEmbeddings
    SyncListenerService --> IndexService
    PgvectorSearcher --> EmbeddingsFactory
```

The retrieval core (`retrieval/core/*` — tokenizer, BM25, RRF, cosine, doc shaping, seed loader) is framework-free on purpose: `eval/run-eval.ts` runs the exact same ranking code over `infra/db/seed/registry.json` with no DB, no Nest and no LLM.
