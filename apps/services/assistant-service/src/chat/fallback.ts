import type { ChatResponse, ChatTeamRef, Locale } from '@orbit/shared';
import type { RetrievedTeam } from '../retrieval/core/hybrid';

/**
 * Deterministic extractive answers used when GEMINI_API_KEY is unset (or
 * the LLM call fails): plain-text template in the requested language naming
 * the top-2 retrieved teams. Keeps `make docker-up` fully working offline.
 */

const SUGGESTION: Record<Locale, (t1: string, t2: string | null) => string> = {
  en: (t1, t2) =>
    `This looks like a ticket for ${t1}.` +
    (t2 ? ` If that does not fit, ${t2} is the next closest match in the registry.` : '') +
    ' AI answers are currently offline, so this suggestion comes from registry search only.',
  hu: (t1, t2) =>
    `Ez a jegy leginkább a(z) ${t1} csapathoz tartozik.` +
    (t2 ? ` Ha mégsem hozzájuk illik, a(z) ${t2} a következő legközelebbi találat a regiszterben.` : '') +
    ' Az AI-válaszok jelenleg nem érhetők el, ez a javaslat kizárólag a regiszterkeresésen alapul.',
  fr: (t1, t2) =>
    `Cette demande semble relever de l'équipe ${t1}.` +
    (t2 ? ` Si ce n'est pas le bon choix, l'équipe ${t2} est la deuxième correspondance la plus proche dans le registre.` : '') +
    " Les réponses IA sont actuellement désactivées ; cette suggestion repose uniquement sur la recherche dans le registre.",
  nl: (t1, t2) =>
    `Dit lijkt een ticket voor ${t1}.` +
    (t2 ? ` Als dat niet past, is ${t2} de op één na beste match in het register.` : '') +
    ' AI-antwoorden zijn momenteel offline; deze suggestie is alleen gebaseerd op zoeken in het register.',
};

const NO_MATCH: Record<Locale, string> = {
  en: 'I could not find a matching team in the registry for that. Try describing the system, application or error involved.',
  hu: 'Nem találtam megfelelő csapatot a regiszterben. Próbáld meg leírni az érintett rendszert, alkalmazást vagy hibát.',
  fr: "Je n'ai pas trouvé d'équipe correspondante dans le registre. Essayez de décrire le système, l'application ou l'erreur concernés.",
  nl: 'Ik kon geen passend team vinden in het register. Probeer het betrokken systeem, de applicatie of de fout te beschrijven.',
};

export function buildFallbackResponse(lang: Locale, retrieved: RetrievedTeam[]): ChatResponse {
  const first = retrieved[0];
  if (!first) {
    return { answer: NO_MATCH[lang], teams: [] };
  }
  const second = retrieved[1];
  const answer = SUGGESTION[lang](
    `${first.name} (${first.key})`,
    second ? `${second.name} (${second.key})` : null,
  );
  const teams: ChatTeamRef[] = [{ queueKey: first.key, name: first.name, confidence: 0.7 }];
  if (second) teams.push({ queueKey: second.key, name: second.name, confidence: 0.5 });
  return { answer, teams };
}

export function buildNoMatchResponse(lang: Locale): ChatResponse {
  return { answer: NO_MATCH[lang], teams: [] };
}
