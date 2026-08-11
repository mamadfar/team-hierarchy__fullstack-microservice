/** How the UI should explain a sync failure. */
export type SyncErrorKind = 'structure' | 'config';

const STRUCTURE_RE =
  /teams table|company config|config table|missing (required )?column|missing team name|missing queue key|missing tribe|missing domain|invalid queue|queue key|duplicate queue|invalid hue|invalid row|refusing to sync|required column/i;

const CONFIG_RE =
  /confluence_(base_url|email|api_token|page_ids)|page_ids is empty|credentials|api token|authentication failed|\b401\b|\b403\b|\b404\b|unauthorized|forbidden|page not found|upstream request failed|mock_confluence|space view|service account|access denied/i;

/**
 * Classify registry/web sync failures so the guide can show structure+sample
 * vs actionable env/auth steps (never treat secrets as the fix payload).
 */
export function categorizeSyncError(
  status: number | null | undefined,
  message: string,
): SyncErrorKind {
  const text = message.trim();
  if (!text) return status === 422 ? 'structure' : 'config';

  if (status === 422 || STRUCTURE_RE.test(text)) return 'structure';
  if (
    status === 401 ||
    status === 403 ||
    status === 404 ||
    CONFIG_RE.test(text) ||
    (status != null && status >= 500)
  ) {
    return 'config';
  }
  return 'structure';
}
