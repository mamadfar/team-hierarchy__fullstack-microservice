/**
 * Paste-ready Helix-style Confluence tables (English headers — parser matches by name).
 * Same contract as docs/CONFLUENCE_SETUP.md §3 / README mandatory layout.
 */
export const CONFLUENCE_SAMPLE_MARKDOWN = `| Key | Value |
|---|---|
| Name | Helix Commerce |
| Icon | cart |
| Color | 215 |

| Team Name | Queue Key | Tribe | Domain | Description | Applications | Keywords | Icon | Channel | Team Lead | On-call |
|---|---|---|---|---|---|---|---|---|---|---|
| Cart & Checkout | HLX-CHK | Conversion | Storefront | Cart, promo codes, checkout funnel. | Cart Service, Checkout Web | cart stuck, checkout | cart | #hlx-checkout | Leo Park | hlx-checkout-oncall |
| Catalog Search | HLX-SRC | Discovery | Storefront | Product search and ranking. | Search API | search relevance | search | #hlx-search | Sam Lee | hlx-search-oncall |
`;
