import type { ChatTeamRef } from '@orbit/shared';
import type { RetrievedTeam } from '../retrieval/core/hybrid';
import type { AnswerDraft } from './llm.provider';

/**
 * Grounding enforcement: whatever the model returns, only queue keys that
 * were actually retrieved survive. Keys are normalized (trim/uppercase),
 * deduplicated, capped at 3, confidence clamped to [0,1], and the public
 * team name is filled server-side from the registry rows — the model never
 * controls display names.
 */
export function filterAnswerTeams(
  draft: Pick<AnswerDraft, 'teams'>,
  retrieved: RetrievedTeam[],
): ChatTeamRef[] {
  const byKey = new Map(retrieved.map((t) => [t.key.toUpperCase(), t]));
  const seen = new Set<string>();
  const out: ChatTeamRef[] = [];

  for (const candidate of draft.teams) {
    const key = candidate.queueKey.trim().toUpperCase();
    const match = byKey.get(key);
    if (!match || seen.has(key)) continue;
    seen.add(key);
    out.push({
      queueKey: match.key,
      name: match.name,
      confidence: clamp01(candidate.confidence),
    });
    if (out.length === 3) break;
  }
  return out;
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
