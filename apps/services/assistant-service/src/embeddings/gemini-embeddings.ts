import { Embeddings } from '@langchain/core/embeddings';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { EMBEDDING_DIMENSIONS } from './embeddings.factory';

/**
 * gemini-embedding-001 defaults to 3072 dims; our column is vector(1536).
 * MRL truncation of the leading dims + L2 normalize matches Gemini's guidance
 * when outputDimensionality isn't available on this LangChain client version.
 */
function truncateAndNormalize(vector: number[], dims: number): number[] {
  const sliced = vector.length > dims ? vector.slice(0, dims) : vector;
  if (sliced.length !== dims) {
    throw new Error(
      `gemini embedding length ${sliced.length} cannot fill vector(${dims}) — check EMBEDDING_MODEL`,
    );
  }
  let sumSquares = 0;
  for (const v of sliced) sumSquares += v * v;
  const norm = Math.sqrt(sumSquares);
  if (!Number.isFinite(norm) || norm === 0) {
    return sliced.map(() => 0);
  }
  return sliced.map((v) => v / norm);
}

/** LangChain Embeddings adapter for Gemini, forced to EMBEDDING_DIMENSIONS. */
export class GeminiEmbeddings extends Embeddings {
  private readonly inner: GoogleGenerativeAIEmbeddings;

  constructor(apiKey: string, model: string) {
    super({});
    this.inner = new GoogleGenerativeAIEmbeddings({
      apiKey,
      model,
    });
  }

  embedDocuments(documents: string[]): Promise<number[][]> {
    return this.caller.call(async () => {
      const vectors = await this.inner.embedDocuments(documents);
      return vectors.map((v) => truncateAndNormalize(v, EMBEDDING_DIMENSIONS));
    });
  }

  embedQuery(document: string): Promise<number[]> {
    return this.caller.call(async () => {
      // Queries should use RETRIEVAL_QUERY; re-create isn't needed — truncate is enough
      // for cosine ranking consistency with our stored truncated docs.
      const vector = await this.inner.embedQuery(document);
      return truncateAndNormalize(vector, EMBEDDING_DIMENSIONS);
    });
  }
}
