import type { ChatMessage, Locale } from '@orbit/shared';
import type { RetrievedTeam } from '../retrieval/core/hybrid';

export const LANGUAGE_NAMES: Record<Locale, string> = {
  en: 'English',
  hu: 'Hungarian',
  fr: 'French',
  nl: 'Dutch',
};

/**
 * Query-rewrite prompt.
 *
 * Employees complain in product language ("can't log in", "we got charged
 * twice"); the registry speaks in team/keyword language ("login
 * authentication SSO password sign-in"). This prompt turns the last user
 * message (+ recent history for pronoun resolution) into ONE standalone
 * lexical search query with likely synonyms, which is what BM25 + the
 * embedding both consume. It must never answer, never mention teams.
 */
export function buildRewriteSystemPrompt(): string {
  return [
    'You turn an employee help request into one short search query for an internal team directory.',
    'The directory rows contain team names, ticket queue keys (like "PAY-CHK"), descriptions, owned applications and support keywords across payments, risk, growth, data, platform, IT and internal operations.',
    '',
    'Rules:',
    '- Output ONLY the search query: a single line of space-separated terms. No quotes, no punctuation, no explanation, no leading labels.',
    '- Keep every concrete noun from the message: product names, system names, error words, acronyms, queue keys.',
    '- Add 3-6 synonyms or adjacent terms a team directory would use for the same problem.',
    '  Example: "I can\'t log in" -> "login authentication SSO password sign-in account access".',
    '  Example: "customer got charged twice" -> "duplicate charge card payment capture reconciliation mismatch refund".',
    '- If the message is a follow-up ("and who fixes that?", "what about mobile?"), resolve what "that"/"it" refers to from the earlier messages and fold it into the query.',
    '- Do NOT answer the question. Do NOT name or guess teams. Just produce the query.',
  ].join('\n');
}

/**
 * The human turn for the rewrite call: compact history (context only) + the
 * message to rewrite.
 */
export function buildRewriteUserPrompt(messages: ChatMessage[]): string {
  const lastUserIndex = findLastUserIndex(messages);
  const lastUser = lastUserIndex >= 0 ? messages[lastUserIndex] : undefined;
  const history = messages
    .slice(Math.max(0, lastUserIndex - 6), Math.max(0, lastUserIndex))
    .map((m) => `${m.role === 'user' ? 'employee' : 'assistant'}: ${m.content}`)
    .join('\n');

  const parts: string[] = [];
  if (history.length > 0) {
    parts.push('Conversation so far (context only):', history, '');
  }
  parts.push(`Message to turn into a search query: ${lastUser?.content ?? ''}`);
  return parts.join('\n');
}

/**
 * Answer prompt.
 *
 * Evolution of the prototype's sendChat prompt ("You are Orbit, ... Rules:
 * plain text only ... use ONLY the directory below ... End with a final line
 * TEAMS: ..."), improved in three ways:
 *  1. grounding is scoped to the 8 RETRIEVED candidates instead of the whole
 *     directory (smaller, more relevant context), and the model is told the
 *     list is exhaustive;
 *  2. team keys come back as STRUCTURED output (tool call) instead of a
 *     fragile "TEAMS:" text suffix that needed regex stripping;
 *  3. explicit ambiguity and no-match behavior, and hard language rules.
 * Server-side we additionally drop any returned key that is not in the
 * retrieved set, so an invented key can never reach the UI.
 */
export function buildAnswerSystemPrompt(opts: { lang: Locale; teams: RetrievedTeam[] }): string {
  const language = LANGUAGE_NAMES[opts.lang];
  const candidateBlocks = opts.teams
    .map((t, i) => `[${i + 1}] ${t.text.replace(/\n/g, ' | ')}`)
    .join('\n');

  return [
    'You are Orbit, the group\'s internal team-routing assistant. An employee describes a problem or question; you tell them which team should receive the ticket.',
    '',
    `Below are the ${opts.teams.length} candidate teams retrieved from the team registry for this request. They are the ONLY teams that exist for you: every recommendation must be grounded in them.`,
    '',
    'RULES',
    '- Never invent or alter a team, queue key, application, channel or person. Only use what appears in the candidates.',
    '- Recommend the single best team by its public name AND queue key, e.g. Checkout (PAY-CHK), and justify the routing in a few words using its description, applications or keywords.',
    '- If two candidates could both own the ticket, present the 2 closest ones and say in one clause each what distinguishes them, so the employee can choose.',
    '- If no candidate fits, say you could not find a clear owner, then point at the closest candidate explicitly marked as a guess.',
    '- Write 2 to 4 short sentences of PLAIN TEXT: no markdown, no asterisks, no bullets, no headings, no emoji.',
    `- Write the entire answer in ${language}. Team names, queue keys and application names stay exactly as written in the candidates.`,
    '',
    'Use the structured output tool for your result: "answer" is the plain-text answer described above; "teams" is 1-3 queue keys copied exactly from the candidates, best match first, each with a confidence between 0 and 1 (use lower confidence when you are guessing).',
    '',
    `CANDIDATE TEAMS (${opts.teams.length}):`,
    candidateBlocks,
  ].join('\n');
}

export function findLastUserIndex(messages: ChatMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === 'user') return i;
  }
  return -1;
}

/** Post-process the rewrite completion into a safe one-line query. */
export function sanitizeRewrittenQuery(raw: string, fallback: string): string {
  const cleaned = raw
    .replace(/^["'\s]+|["'\s]+$/g, '')
    .replace(/^(search query|query)\s*[:=]\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
  return cleaned.length > 0 ? cleaned : fallback;
}
