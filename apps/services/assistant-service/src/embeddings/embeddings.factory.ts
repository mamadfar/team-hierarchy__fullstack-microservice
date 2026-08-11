import { Logger } from '@nestjs/common';
import type { Embeddings } from '@langchain/core/embeddings';
import type { Env } from '../config/env';
import { GeminiEmbeddings } from './gemini-embeddings';
import { MockEmbeddings } from './mock-embeddings';

/** team_documents.embedding is vector(1536) — every provider must emit 1536 dims. */
export const EMBEDDING_DIMENSIONS = 1536;

/**
 * Returns a LangChain Embeddings implementation for the configured provider.
 * "mock" (default) is deterministic and offline so dev/CI/eval need no keys;
 * "gemini" uses gemini-embedding-001 truncated+normalized to 1536 dims.
 */
export class EmbeddingsFactory {
  private static readonly logger = new Logger(EmbeddingsFactory.name);

  static create(
    env: Pick<Env, 'EMBEDDING_PROVIDER' | 'EMBEDDING_MODEL' | 'GEMINI_API_KEY'>,
  ): Embeddings {
    switch (env.EMBEDDING_PROVIDER) {
      case 'gemini':
        this.logger.log(`embeddings: gemini (${env.EMBEDDING_MODEL} → ${EMBEDDING_DIMENSIONS}d)`);
        return new GeminiEmbeddings(env.GEMINI_API_KEY!, env.EMBEDDING_MODEL);
      default:
        this.logger.log('embeddings: mock (deterministic, offline)');
        return new MockEmbeddings(EMBEDDING_DIMENSIONS);
    }
  }
}
