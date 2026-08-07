# Frontend deep reference (apps/web)

The design is a **high-fidelity contract**, not inspiration. Source of truth: the gitignored `orbit/` handoff (`README.md` = behavior spec, `Orbit Team Atlas.dc.html` = tokens/copy/dictionaries, `flow-canvas.js` = canvas algorithms). Production mirrors live in the repo — change those only to fix divergence *from the prototype*, never to "improve" the design.

## Fidelity anchors
- **Tokens**: `src/app/globals.css` — exact light/dark custom properties from the prototype, mapped onto shadcn-style vars. Entity colors are data: `oklch(55% 0.17 h)` solid / `oklch(60% 0.14 h / a)` tint (`src/lib/colors.ts`); hues come from the registry, identical in both themes.
- **Canvas**: `src/components/canvas/layout.ts` ports both layout algorithms with the prototype's constants (cardW 214, cardH 64, colW 240, domGapX 90, compGap 130; hierarchy rows y 0/160/320/470…). Node types: team, domainBox, tribeLabel, companyLabel, rootCard, companyCard, domainCard, tribeCard. Behaviors that must survive any refactor: collaboration-edge highlight + labels on selection, search dimming, hierarchy branch focus (zoom + accent edges + 0.2 dim + ring), team focus zoom (fitView ~550ms, maxZoom 1.2; hierarchy → owning tribe card), tab-switch refit, minimap above the chat FAB (`marginBottom: 74`), nodes non-draggable/non-connectable.
- **Search ranking** (`src/lib/search.ts`): exact port — key exact 100 / key 60 / name prefix 70 / name 50 / keywords 40 / apps 35 / path 25 / description 20, AND across tokens, top 40. Unit tests pin ranked order; don't add fuzziness.
- **Fonts**: Sora (600/700) + Source Sans 3 via next/font, `ui-monospace` for keys/page ids, base 13px.
- **Icons**: `ORBIT_TO_LUCIDE` in `@orbit/shared` maps registry icon names → lucide-react components (`src/lib/icons.tsx`). New icon = add to the shared map, never a one-off import.

## i18n rules
- All four dictionaries (`messages/{en,hu,fr,nl}.json`) originate from the prototype's `I18N` object; keys change in lockstep (unit test enforces parity). Placeholders use next-intl syntax (`{m}`, `{k}`).
- Locale: `NEXT_LOCALE` cookie, no path prefix; flags are inline SVGs in `src/components/flags.tsx` (UK flag = English). The chat request's `lang` always follows the active locale.

## Accessibility
Icon-only buttons carry `aria-label`/`title`; focus-visible rings use `--ring`; `/` focuses search (expands sidebar first) and Escape closes panel/chat/menus — both skip when typing in inputs; the detail panel is `role="dialog"` labeled by team name, focuses its close button on open and restores focus on close.
