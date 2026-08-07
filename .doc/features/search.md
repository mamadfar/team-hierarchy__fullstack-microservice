# Feature: search

## What it does
The sidebar search ranks teams as you type, dims non-matching nodes on the canvas, and zooms to a team on selection. `/` focuses the input (expanding a collapsed sidebar first); the clear button and Escape reset it.

## Architecture decisions
- **Exact port of the prototype scoring** ([apps/web/src/lib/search.ts](../../apps/web/src/lib/search.ts)) so ranking behavior is pixel-for-pixel identical to the approved design:

```ts
if (hay.k === tok) s = 100;            // exact queue key
else if (hay.k.includes(tok)) s = 60;  // key fragment
if (hay.n.startsWith(tok)) s = Math.max(s, 70);  // name prefix
else if (hay.n.includes(tok)) s = Math.max(s, 50);
if (hay.kw.includes(tok)) s = Math.max(s, 40);   // keywords
if (hay.a.includes(tok)) s = Math.max(s, 35);    // apps
if (hay.path.includes(tok)) s = Math.max(s, 25); // tribe + domain
if (hay.d.includes(tok)) s = Math.max(s, 20);    // description
if (!s) return null;                   // AND across tokens
```

  Tokens AND-combine (every token must match somewhere); per-token score is the max across fields; totals sort descending, top 40.
- **Pure client-side over the loaded snapshot** — the registry is fetched once and is tiny (~81 teams), so no search endpoint, no debounce round-trips, instant results. Match keys feed the canvas as a `Set` for dimming.
- **Backend capability kept**: `teams.search_tsv` (weighted tsvector + GIN) exists for future server-side search (e.g. if the registry grows 100×) without a schema change.
- The pure function is unit-tested against the real seed (ranked-order cases, e.g. `kafka` → DATA-STR first).

## Alternatives considered
- **Postgres FTS endpoint**: correct at scale, but adds latency + loading states for zero benefit at 81 rows.
- **Fuse.js / fuzzy matching**: fuzzy hits would *diverge* from the approved prototype behavior; typo tolerance was not part of the design.

## Security & performance notes
- No user input leaves the browser for search — nothing to sanitize server-side.
- O(teams × tokens) per keystroke over in-memory strings; sub-ms at this size. Haystacks are lowercased per call — memoizable later if the registry grows.
