/**
 * Retrieval eval — `make eval` / `pnpm --filter @orbit/assistant-service run eval`.
 *
 * Runs the EXACT retrieval core the service uses (OkapiBM25 + mock-embedding
 * cosine + Reciprocal Rank Fusion + the same doc shaping) in-process over the
 * canonical seed file — no DB, no Redis, no LLM, no network. Reports top-1 /
 * top-3 accuracy against eval/golden.jsonl (hit = ANY expected key in top-N)
 * with per-miss diagnostics. Exits non-zero when top-3 accuracy < 90%.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { MockEmbeddings } from '../src/embeddings/mock-embeddings';
import type { RankedResult } from '../src/retrieval/core/bm25';
import { InMemoryVectorIndex } from '../src/retrieval/core/cosine';
import { seedToTeamDocs } from '../src/retrieval/core/doc-shaper';
import { HybridRetriever, VectorSearcher } from '../src/retrieval/core/hybrid';
import { loadSeedFile } from '../src/retrieval/core/seed';

const GoldenLineSchema = z.object({
  q: z.string().min(1),
  expect: z.array(z.string().min(1)).min(1),
});
type GoldenLine = z.infer<typeof GoldenLineSchema>;

const TOP3_THRESHOLD = 0.9;

class MockVectorSearcher implements VectorSearcher {
  constructor(
    private readonly embeddings: MockEmbeddings,
    private readonly index: InMemoryVectorIndex,
  ) {}

  async search(query: string, limit: number): Promise<RankedResult[]> {
    return this.index.search(await this.embeddings.embedQuery(query), limit);
  }
}

function loadGolden(): GoldenLine[] {
  const path = resolve(__dirname, 'golden.jsonl');
  return readFileSync(path, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((line, i) => {
      try {
        return GoldenLineSchema.parse(JSON.parse(line));
      } catch (err) {
        throw new Error(`golden.jsonl line ${i + 1} invalid: ${(err as Error).message}`);
      }
    });
}

async function main(): Promise<void> {
  const seed = loadSeedFile();
  const docs = seedToTeamDocs(seed);
  const golden = loadGolden();

  const knownKeys = new Set(docs.map((d) => d.key));
  for (const g of golden) {
    for (const key of g.expect) {
      if (!knownKeys.has(key)) {
        throw new Error(`golden.jsonl expects unknown queue key "${key}" (q: "${g.q}")`);
      }
    }
  }

  const embeddings = new MockEmbeddings(1536);
  const vectorIndex = new InMemoryVectorIndex();
  const vectors = await embeddings.embedDocuments(docs.map((d) => d.text));
  vectorIndex.set(
    docs.map((d, i) => ({ id: d.key, vector: vectors[i] ?? [] })),
  );

  const retriever = new HybridRetriever(new MockVectorSearcher(embeddings, vectorIndex), {
    poolSize: 24,
    topN: 8,
    rrfK: 60,
  });
  retriever.setDocs(docs);

  let top1Hits = 0;
  let top3Hits = 0;
  const misses: Array<{ g: GoldenLine; got: string[] }> = [];

  for (const g of golden) {
    const results = await retriever.retrieve(g.q);
    const keys = results.map((r) => r.key);
    const expectSet = new Set(g.expect);
    const hitTop1 = keys.slice(0, 1).some((k) => expectSet.has(k));
    const hitTop3 = keys.slice(0, 3).some((k) => expectSet.has(k));
    if (hitTop1) top1Hits += 1;
    if (hitTop3) top3Hits += 1;
    else misses.push({ g, got: keys.slice(0, 5) });
  }

  const total = golden.length;
  const top1 = top1Hits / total;
  const top3 = top3Hits / total;

  console.log('');
  console.log(`Orbit retrieval eval — ${docs.length} team docs, ${total} golden questions`);
  console.log(`  top-1 accuracy: ${(top1 * 100).toFixed(1)}%  (${top1Hits}/${total})`);
  console.log(`  top-3 accuracy: ${(top3 * 100).toFixed(1)}%  (${top3Hits}/${total})  [gate: >= ${TOP3_THRESHOLD * 100}%]`);

  if (misses.length > 0) {
    console.log('');
    console.log(`top-3 misses (${misses.length}):`);
    for (const m of misses) {
      console.log(`  Q: ${m.g.q}`);
      console.log(`     expected: ${m.g.expect.join(', ')}`);
      console.log(`     got:      ${m.got.join(', ') || '(nothing)'}`);
    }
  }
  console.log('');

  if (top3 < TOP3_THRESHOLD) {
    console.error(`FAIL: top-3 accuracy ${(top3 * 100).toFixed(1)}% is below the ${TOP3_THRESHOLD * 100}% gate`);
    process.exit(1);
  }
  console.log('PASS');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
});
