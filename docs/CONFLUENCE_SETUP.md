# Connecting Orbit to your company Confluence (read-only)

Step-by-step guide to let the registry-service read the team tables from Confluence Cloud. Orbit never writes to Confluence.

## 1. Create a service account + API token
1. Ask your Atlassian admin for a **service account** (e.g. `svc-orbit@company.com`) — don't bind the integration to a personal account.
2. Log in as that account → https://id.atlassian.com/manage-profile/security/api-tokens → **Create API token** → name it `orbit-registry-read` → copy the token once.
3. In Confluence, give the account **read-only** access to only the space holding the registry pages (space permissions → View). Nothing else.

## 2. Identify the pages
1. Each **company has one Confluence page** containing its tables (see contract below).
2. Open each page and take the numeric id from the URL: `https://<org>.atlassian.net/wiki/spaces/ORG/pages/84213977/NovaPay+Team+Registry` → `84213977`.
3. You'll need: `CONFLUENCE_BASE_URL=https://<org>.atlassian.net/wiki` and `CONFLUENCE_PAGE_IDS=84213977,84214102,84214255` (order = display order in the app).

## 3. Page content contract (what Orbit parses)
Two tables per company page. **Column headers are matched case-insensitively by name, not position**, so columns can be reordered in Confluence.

**Table 1 — Company config** (2 columns, key/value rows):
| Key | Value |
|---|---|
| Name | NovaPay |
| Icon | wallet |
| Color | 245 |
| Description | Payments and financial risk arm of the group. |

**Table 2 — Teams** (one row per team):
| Team Name | Queue Key | Tribe | Domain | Description | Applications | Keywords | Icon | Color | Channel | Team Lead | On-call |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Checkout | PAY-CHK | Acceptance | Payments & Billing | Hosted checkout… | Checkout Web, Pay SDK | payment failed, 3ds | cart | | #pay-checkout | Mara Kis | pay-checkout-oncall |

Rules:
- **Queue Key** is the unique id across ALL companies — duplicates fail the sync with a clear error naming both rows.
- Lists (Applications, Keywords) are comma-separated.
- **Icon** = a name from the supported icon list (see the app docs / `ORBIT_ICONS`); **Color** = a hue number 0–360. Both optional — color falls back to the domain hue. This is how each team's icon/color is customized from Confluence.
- Channel / Team Lead / On-call are optional (leave empty).
- Domain rows sharing the same Domain name are grouped; add an optional **Domains** config table (Name | Color | Description) if you want per-domain colors; otherwise Orbit assigns them.
- A **Links** table (optional, usually on the group root page): `Source Key | Target Key | Reason` — drives the collaboration edges.
- Keep cells plain text: no merged cells, no macros inside the tables (status/emoji macros are stripped, but don't rely on them).

### Helix-style sample (copy-paste)

Same rules with commerce naming — also summarized in the root [README](../README.md#confluence-page-layout-mandatory):

| Key | Value |
|---|---|
| Name | Helix Commerce |
| Icon | cart |
| Color | 215 |

| Team Name | Queue Key | Tribe | Domain | Description | Applications | Keywords | Icon | Channel | Team Lead | On-call |
|---|---|---|---|---|---|---|---|---|---|---|
| Cart & Checkout | HLX-CHK | Conversion | Storefront | Cart, promo codes, checkout funnel. | Cart Service, Checkout Web | cart stuck, checkout | cart | #hlx-checkout | Leo Park | hlx-checkout-oncall |
| Catalog Search | HLX-SRC | Discovery | Storefront | Product search and ranking. | Search API | search relevance | search | #hlx-search | Sam Lee | hlx-search-oncall |

If tables/columns are missing, registry-service returns **422** with a message naming the page; the web UI opens a setup guide with this structure (it does not silently show an empty map).

## 4. Test the API access locally
```bash
export CONFLUENCE_BASE_URL="https://<org>.atlassian.net/wiki"
export CONFLUENCE_EMAIL="svc-orbit@company.com"
export CONFLUENCE_API_TOKEN="<token>"

# v2 API — page in storage format (XHTML). 200 + body.storage.value = success
curl -s -u "$CONFLUENCE_EMAIL:$CONFLUENCE_API_TOKEN" \
  "$CONFLUENCE_BASE_URL/api/v2/pages/84213977?body-format=storage" | jq '.title'
```
The registry-service uses exactly this endpoint and parses `body.storage.value` tables with cheerio.

## 5. Local development
1. Copy `.env.example` → `.env`, fill the four `CONFLUENCE_*` vars, set `MOCK_CONFLUENCE=false`.
2. `make dev-infra && make db-migrate && make dev` — registry-service syncs on boot; check `GET /sync/runs` or the app footer ("Synced just now").
3. No Confluence access yet? Keep `MOCK_CONFLUENCE=true` — the bundled seed mirrors the real table contract.

## 6. Production: secrets via GitHub Actions
Set the secrets/variables once (repo → Settings → Secrets and variables → Actions), or via CLI:
```bash
gh secret set CONFLUENCE_BASE_URL   --body "https://<org>.atlassian.net/wiki"
gh secret set CONFLUENCE_EMAIL      --body "svc-orbit@company.com"
gh secret set CONFLUENCE_API_TOKEN  --body "<token>"
gh secret set CONFLUENCE_PAGE_IDS   --body "84213977,84214102,84214255"
gh secret set GEMINI_API_KEY        --body "<gemini-api-key>"
gh secret set DATABASE_URL          --body "postgres://user:pass@host:5432/orbit"
gh secret set REDIS_URL             --body "redis://host:6379"
# generate with: make key NAME=SYNC_APP_TOKEN LENGTH=64
gh secret set SYNC_APP_TOKEN        --body "<64-char-hex>"

gh variable set WEB_ORIGIN --body "https://orbit.example.com"
gh variable set NEXT_PUBLIC_REGISTRY_API_URL --body "https://registry.example.com"
gh variable set NEXT_PUBLIC_ASSISTANT_API_URL --body "https://assistant.example.com"
# optional:
gh variable set NEXT_PUBLIC_TICKET_URL_TEMPLATE --body "https://jira.example.com/secure/CreateIssue.jspa?pid={queueKey}"
gh variable set REGISTRY_API_URL --body "http://registry:4001"
```
`deploy.yml` injects them into the runtime environment at deploy time. They are never baked into images, compose files, or the frontend. Adding a new company later = create the page, append its id to the `CONFLUENCE_PAGE_IDS` secret, redeploy (or re-run the deploy workflow) — no code change.

## 7. Keeping data fresh
- Sync runs **on boot** and on the app's **Refresh** button (`POST /api/sync` same-origin, or Automation `POST /api/sync` with `Authorization: Bearer <SYNC_APP_TOKEN>`).
- Optional periodic sync: set `SYNC_CRON="0 * * * *"`.
- Optional push: a Confluence Automation rule ("page updated" in the space → Send web request → `POST https://orbit.company.com/api/sync` with the app token header) gives near-real-time updates without polling.

## 8. Troubleshooting
- **401** wrong email/token pair (token must belong to that email) · **403** service account lacks space view permission · **404** wrong page id or page moved to a restricted space.
- **429**: the client retries with backoff; if persistent, raise `SYNC_CRON` interval.
- **Rows skipped**: check `GET /sync/runs` — the stats field lists row-level validation errors (missing queue key, bad hue, duplicate key…). Sync is all-or-nothing per page; earlier data stays live on failure.
- **Table not found**: the parser needs the config + teams tables; a page rewritten without them fails loudly, it never silently empties the registry.

## 9. Security notes
- Read-only token, one space, rotate quarterly (calendar reminder); rotating = update one GitHub secret + redeploy.
- Restrict who can edit the registry pages (page restrictions) — edit rights there are effectively admin rights over the app's content.
- The sync endpoint requires the internal app token and is rate-limited. Web `/api/sync` accepts same-origin browser Refresh **or** a valid bearer token (Confluence Automation).
