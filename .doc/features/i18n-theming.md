# Feature: i18n & theming

## What it does
All UI chrome is localized in en/hu/fr/nl (flag dropdown, UK flag for English, native names, check on active); light/dark theme toggles with the sun/moon button. Both persist across reloads. Team data (names, descriptions) intentionally stays in its source language — it comes from Confluence, not from the dictionaries.

## Architecture decisions
- **Dictionaries lifted verbatim from the prototype** (`apps/web/messages/{en,hu,fr,nl}.json`, from the `I18N` object in `orbit/Orbit Team Atlas.dc.html`) — every key including the 3 starter questions and `{m}`/`{k}` placeholders (adapted to next-intl syntax). A unit test asserts all four locales share the exact key set, so a new string cannot ship in one language only.
- **Cookie-based next-intl, no locale path prefix** (`src/i18n/request.ts` + `NEXT_LOCALE` cookie): an internal tool doesn't need locale-in-URL SEO; switching locale = set cookie + `router.refresh()`, keeping canvas state intact.
- **Theme via next-themes class strategy**; the prototype's exact CSS custom properties for both themes live in `globals.css`, mapped onto shadcn-style variables (`--background`, `--primary`, `--ring`, …) so vendored UI primitives and custom components read one token source.
- **Per-entity colors are data, not theme**: company/domain/team hues come from the Confluence tables and render via `oklch(55% 0.17 h)` / `oklch(60% 0.14 h / a)` helpers ([apps/web/src/lib/colors.ts](../../apps/web/src/lib/colors.ts)) — identical in both themes, as designed.
- **The assistant follows the UI language**: the chat request carries `lang: activeLocale`, and the answer prompt hard-requires answering in that language.

Real code — locale resolution ([apps/web/src/i18n/request.ts](../../apps/web/src/i18n/request.ts)):

```ts
export default getRequestConfig(async () => {
  const store = await cookies();
  const candidate = store.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(candidate) ? candidate : DEFAULT_LOCALE;
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
```

## Alternatives considered
- **Path-prefix locales (`/hu/...`)**: standard for public sites; rejected — URL churn and refit of the canvas on navigation, no SEO need.
- **User-profile persistence**: right end-state once real auth exists; cookie is the correct v1 (prototype used localStorage).

## Security & performance notes
- Locale cookie is `samesite=lax`, non-sensitive. Dictionaries are static JSON — no dynamic message compilation, no injection surface (next-intl escapes interpolations).
- Theme swap is a class flip — zero relayout of React Flow nodes (colors are CSS vars).
