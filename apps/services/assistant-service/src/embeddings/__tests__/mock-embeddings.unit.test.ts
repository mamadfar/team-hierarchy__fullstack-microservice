import { describe, expect, it } from 'vitest';
import { cosineSimilarity } from '../../retrieval/core/cosine';
import { MockEmbeddings } from '../mock-embeddings';

describe('MockEmbeddings', () => {
  const embeddings = new MockEmbeddings(1536);

  it('is deterministic: same text always yields the identical vector', async () => {
    const [a] = await embeddings.embedDocuments(['kafka consumer lag is growing']);
    const b = await embeddings.embedQuery('kafka consumer lag is growing');
    expect(a).toEqual(b);
  });

  it('emits 1536-dim L2-normalized vectors', async () => {
    const vec = await embeddings.embedQuery('payment failed at checkout');
    expect(vec).toHaveLength(1536);
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
    expect(norm).toBeCloseTo(1, 6);
  });

  it('scores overlapping-token texts higher than disjoint ones', async () => {
    const query = await embeddings.embedQuery('kafka consumer lag');
    const related = await embeddings.embedQuery('kafka lag on a topic');
    const unrelated = await embeddings.embedQuery('office wifi printer badge');
    const simRelated = cosineSimilarity(query, related);
    const simUnrelated = cosineSimilarity(query, unrelated);
    expect(simRelated).toBeGreaterThan(simUnrelated);
    expect(simRelated).toBeGreaterThan(0.2);
  });

  it('handles empty text without NaN', async () => {
    const vec = await embeddings.embedQuery('');
    expect(vec).toHaveLength(1536);
    expect(vec.every((v) => Number.isFinite(v))).toBe(true);
  });
});
