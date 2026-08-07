import { Logger } from '@nestjs/common';
import type { Embeddings } from '@langchain/core/embeddings';
import { OpenAIEmbeddings } from '@langchain/openai';
import { VoyageEmbeddings } from '@langchain/community/embeddings/voyage';
import type { Env } from '../config/env';
import { MockEmbeddings } from './mock-embeddings';

/** team_documents.embedding is vector(1536) — every provider must emit 1536 dims. */
export const EMBEDDING_DIMENSIONS = 1536;

/**
 * Returns a LangChain Embeddings implementation for the configured provider.
 * "mock" (default) is deterministic and offline so dev/CI/eval need no keys;
 * "voyage"/"openai" are real providers wired through the same interface so
 * swapping is a pure env change.
 */
export class EmbeddingsFactory {
  private static readonly logger = new Logger(EmbeddingsFactory.name);

  static create(env: Pick<Env, 'EMBEDDING_PROVIDER' | 'EMBEDDING_MODEL' | 'EMBEDDING_API_KEY'>): Embeddings {
    switch (env.EMBEDDING_PROVIDER) {
      case 'voyage':
        this.logger.log(`embeddings: voyage (${env.EMBEDDING_MODEL})`);
        return new VoyageEmbeddings({
          apiKey: env.EMBEDDING_API_KEY,
          modelName: env.EMBEDDING_MODEL,
        });
      case 'openai':
        this.logger.log(`embeddings: openai (${env.EMBEDDING_MODEL})`);
        return new OpenAIEmbeddings({
          apiKey: env.EMBEDDING_API_KEY,
          model: env.EMBEDDING_MODEL,
          dimensions: EMBEDDING_DIMENSIONS,
        });
      default:
        this.logger.log('embeddings: mock (deterministic, offline)');
        return new MockEmbeddings(EMBEDDING_DIMENSIONS);
    }
  }
}
