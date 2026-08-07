/**
 * Shared tokenizer for BM25 and the mock embedding: lowercase, split on
 * anything that is not [a-z0-9], drop pure function words (stopwords for the
 * four UI languages), and for plural-ish tokens ("payouts", "bots") ALSO emit
 * the stripped singular so index and query match without a real stemmer.
 * Emission is symmetric (applied to docs and queries alike), so
 * document-length normalization stays fair.
 *
 * The stopword list is deliberately limited to articles / prepositions /
 * pronouns / auxiliaries. Words like "down", "up", "failed" carry routing
 * signal ("site is down") and MUST stay out of this list.
 */
const STOPWORDS = new Set([
  // en
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'in', 'on', 'at', 'of', 'for', 'to', 'from', 'with', 'without', 'into',
  'and', 'or', 'but', 'not', 'no', 'nor', 'so', 'if', 'then', 'than',
  'it', 'its', 'this', 'that', 'these', 'those', 'there', 'here',
  'i', 'we', 'you', 'they', 'he', 'she', 'me', 'us', 'them',
  'my', 'our', 'your', 'their', 'his', 'her',
  'do', 'does', 'did', 'have', 'has', 'had',
  'can', 'cannot', 'cant', 'could', 'should', 'would', 'will',
  'dont', 'doesnt', 'didnt', 'isnt', 'arent', 'wasnt', 'wont',
  'am', 'been', 'as', 'by', 'about',
  // hu
  'az', 'egy', 'és', 'es', 'hogy', 'nem', 'van', 'vannak', 'volt', 'lesz',
  'ez', 'azt', 'ezt', 'mi', 'ki', 'ha', 'csak', 'mert', 'meg', 'el',
  'egy', 'nekem', 'nekünk', 'nálam', 'hol', 'mikor', 'miért', 'hogyan',
  // fr
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'd', 'l', 'et', 'ou',
  'mais', 'ne', 'pas', 'est', 'sont', 'était', 'je', 'tu', 'il', 'elle',
  'nous', 'vous', 'ils', 'elles', 'mon', 'ma', 'mes', 'notre', 'votre',
  'que', 'qui', 'quoi', 'dans', 'sur', 'pour', 'par', 'avec', 'sans',
  'au', 'aux', 'ce', 'cette', 'ces', 'se', 'sa', 'son', 'ses', 'y', 'en',
  // nl
  'het', 'een', 'of', 'maar', 'niet', 'zijn', 'was', 'waren', 'ben', 'bent',
  'ik', 'je', 'jij', 'hij', 'zij', 'we', 'wij', 'jullie', 'ze',
  'mijn', 'onze', 'uw', 'hun', 'dat', 'dit', 'deze', 'die',
  'op', 'aan', 'van', 'voor', 'met', 'zonder', 'naar', 'bij', 'om', 'te',
  'wat', 'wie', 'hoe', 'waarom', 'waar', 'wanneer',
  'kan', 'kunnen', 'moet', 'moeten', 'wordt', 'worden', 'werd', 'er',
]);

export function tokenize(text: string): string[] {
  const base = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0 && !STOPWORDS.has(t));
  const out: string[] = [];
  for (const token of base) {
    out.push(token);
    if (token.length > 3 && token.endsWith('s') && !token.endsWith('ss')) {
      out.push(token.slice(0, -1));
    }
  }
  return out;
}
