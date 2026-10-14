# Orbit — Team Atlas

Internal team-discovery and ticket-routing app. Interactive React Flow map of the whole group (companies → domains → tribes → teams), full-text search, per-team detail panel (queue key, apps, contacts), and an AI routing assistant grounded in the team registry. The registry lives in **Confluence tables** (one page per company); the app is strictly **read-only** — all edits happen in Confluence and land here on the next sync.

## Quickstart

```bash
make setup       # pnpm install + .env from .env.example
make up          # first start: build and start web, services, postgres(pgvector), redis
# → http://localhost:3000  (MOCK_CONFLUENCE=true: boots fully offline from the bundled seed)
```

After the containers have been created, use `make run` to start them again
without building images or creating containers.

Local development (infra in Docker, apps in watch mode):

```bash
make dev-infra && make db-migrate && make db-seed && make dev
```

All commands: `make help`.

After frontend changes, run `make up-web` to rebuild and restart only the web
container. The local stack must already be running; backend services and
databases are left untouched.

## Layout

| Path | What |
|---|---|
| `apps/web` | Next.js (App Router) frontend — canvas, search, detail panel, chat |
| `apps/services/registry-service` | NestJS — Confluence ingestion + registry API (port 4001, Swagger at `/docs`) |
| `apps/services/assistant-service` | NestJS — RAG chat API (port 4002, Swagger at `/docs`) |
| `packages/shared` | Shared zod schemas, TS types, Drizzle table defs, icon map |
| `infra/` | Dockerfiles, compose files, DB init + seed |
| `.doc/` | Architecture diagrams (Mermaid) + feature docs |
| `docs/CONFLUENCE_SETUP.md` | How to connect the app to your company Confluence |

## Environment

Contract lives in [.env.example](.env.example) — every variable documented there; each service validates its subset with zod at boot. Key ones:

| Var | Purpose |
|---|---|
| `DATABASE_URL`, `REDIS_URL` | Postgres 16 + pgvector, Redis cache |
| `CONFLUENCE_BASE_URL` / `EMAIL` / `API_TOKEN` / `PAGE_IDS` | Read-only Confluence ingestion ([setup guide](docs/CONFLUENCE_SETUP.md)) |
| `MOCK_CONFLUENCE` | `true` = ingest from `infra/db/seed` (default in dev/CI — CI never hits real Confluence). Unset in production defaults to `false`. |
| `SYNC_APP_TOKEN` | Bearer token required by `POST /sync` (and authorized `/api/sync`). Generate: `make key NAME=SYNC_APP_TOKEN` |
| `GEMINI_API_KEY`, `LLM_MODEL` | Assistant LLM (Gemini via LangChain; default model `gemini-3.5-flash-lite`) |
| `EMBEDDING_PROVIDER` / `EMBEDDING_MODEL` | `mock` (offline, default) / `gemini` (`gemini-embedding-001`, needs `GEMINI_API_KEY`) |
| `NEXT_PUBLIC_*` | Frontend API URLs + ticket deep-link template |
| `REGISTRY_API_URL` | Web server-only registry URL for the sync proxy (docker: `http://registry:4001`) |

Generate secrets locally:

```bash
make key NAME=SYNC_APP_TOKEN          # 64 hex chars (default)
make key NAME=SYNC_APP_TOKEN LENGTH=32
```

When `MOCK_CONFLUENCE=false`, set `SYNC_APP_TOKEN` in `.env` to the generated value before running `make up`. Real Confluence mode requires at least 32 characters and rejects `dev-sync-token`; otherwise the registry cannot start. The Makefile passes `.env` to Compose for both registry and web.

## Confluence page layout (mandatory)

Orbit ingests **one Confluence page per company**. Full contract, auth setup, and troubleshooting: **[docs/CONFLUENCE_SETUP.md](docs/CONFLUENCE_SETUP.md)** (single source of truth). Summary:

| Table | Required? | What |
|---|---|---|
| **Company config** | Yes | Key/Value rows; at least **Name**. Optional: Icon, Color (hue 0–360), Description. |
| **Teams** | Yes | Headers must include **Team Name** + **Queue Key** (also **Tribe** + **Domain**). Optional: Description, Applications, Keywords, Icon, Color, Channel, Team Lead, On-call. |
| **Domains** | Optional | Name \| Color \| Description — per-domain hues. |
| **Links** | Optional | Source Key \| Target Key \| Reason — collaboration edges on the map. |

Rules:
- Headers are matched **by name** (case-insensitive), not column order.
- **Queue Key** format like `HLX-CHK` — **unique across all companies** (duplicates fail sync naming both rows).
- **Icon** = supported icon name; **Color** = hue 0–360 (optional; team color falls back to domain).
- One page id per company in `CONFLUENCE_PAGE_IDS` (order = display order).
- Missing config/teams tables or required columns → sync **422** with a clear message; the UI shows this guide instead of an empty map. Previous snapshot stays live on failure.
- **Refresh** (UI) is client rate-limited (~20s cooldown) and aborts an in-flight sync if another starts; registry `POST /sync` remains throttled at **3/min** (bearer `SYNC_APP_TOKEN`).

### Starter page (mock data — copy into Confluence, then replace)

Paste the following tables into a new Confluence page. The values are intentionally fictional but demonstrate the expected structure and relationships.

**Copy area**

```text
Company config

| Key | Value |
|---|---|
| Name | Northstar Labs |
| Icon | building |
| Color | 205 |
| Description | Software products, developer tooling, and platform operations. |

Teams

| Team Name | Queue Key | Tribe | Domain | Description | Applications | Keywords | Icon | Color | Channel | Team Lead | On-call |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Developer Experience | NSL-DXP | Product Engineering | Engineering | Tooling and workflows that help teams ship software. | Dev Portal, Buildkite | local setup, CI pipeline | code | 190 | #nsl-devex | Priya Shah | nsl-devex-oncall |
| Identity Platform | NSL-IDP | Core Services | Platform | Authentication, authorization, and account lifecycle. | Identity API, Admin Console | login, permissions, SSO | lock | 225 | #nsl-identity | Mateo Ruiz | nsl-identity-oncall |
| Observability | NSL-OBS | Core Services | Platform | Metrics, logs, traces, and production health. | Grafana, Alertmanager | alert, dashboard, incident | activity | 245 | #nsl-observability | Erin Cole | nsl-observability-oncall |

Domains

| Name | Color | Description |
|---|---|---|
| Engineering | 190 | Product development and developer productivity. |
| Platform | 235 | Shared services and operational foundations. |

Links

| Source Key | Target Key | Reason |
|---|---|---|
| NSL-DXP | NSL-IDP | Developer tools use platform identity and access controls. |
| NSL-OBS | NSL-IDP | Identity service telemetry is monitored by Observability. |
```

**Company config**

| Key | Value |
|---|---|
| Name | Northstar Labs |
| Icon | building |
| Color | 205 |
| Description | Software products, developer tooling, and platform operations. |

**Teams**

| Team Name | Queue Key | Tribe | Domain | Description | Applications | Keywords | Icon | Color | Channel | Team Lead | On-call |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Developer Experience | NSL-DXP | Product Engineering | Engineering | Tooling and workflows that help teams ship software. | Dev Portal, Buildkite | local setup, CI pipeline | code | 190 | #nsl-devex | Priya Shah | nsl-devex-oncall |
| Identity Platform | NSL-IDP | Core Services | Platform | Authentication, authorization, and account lifecycle. | Identity API, Admin Console | login, permissions, SSO | lock | 225 | #nsl-identity | Mateo Ruiz | nsl-identity-oncall |
| Observability | NSL-OBS | Core Services | Platform | Metrics, logs, traces, and production health. | Grafana, Alertmanager | alert, dashboard, incident | activity | 245 | #nsl-observability | Erin Cole | nsl-observability-oncall |

**Domains** (optional)

| Name | Color | Description |
|---|---|---|
| Engineering | 190 | Product development and developer productivity. |
| Platform | 235 | Shared services and operational foundations. |

**Links** (optional)

| Source Key | Target Key | Reason |
|---|---|---|
| NSL-DXP | NSL-IDP | Developer tools use platform identity and access controls. |
| NSL-OBS | NSL-IDP | Identity service telemetry is monitored by Observability. |

Set `MOCK_CONFLUENCE=false` and `CONFLUENCE_PAGE_IDS=<your page id>` after the pages exist. Offline/dev without Confluence: keep `MOCK_CONFLUENCE=true` (bundled seed).

## Aurora Group Confluence pages

The bundled mock registry contains **111 teams**: NovaPay (34), Lumen Commerce (38), and Aurora Shared Services (39). All organizations, applications, and contacts below are fictional demo data.

Create **three Confluence pages**, one per company. Copy only the contents of that company's Markdown block, not the surrounding README or the other companies. Orbit reads the first company config and teams table on each page, so combining them into one page will not import all teams.

These are raw Markdown copy areas. If your Confluence editor pastes pipe-delimited Markdown as plain text, use its Markdown import/paste support or convert it to native tables before syncing. Orbit needs actual tables, not a code block or Markdown macro. Leave optional empty cells empty; lists are comma-separated. Links are assigned to the page owning their source team and should be imported together with all three company pages.

<!-- AURORA_TABLES_START -->

### NovaPay

34 teams. Copy this block into the **NovaPay** Confluence page.

```markdown
**Company config**

| Key | Value |
| --- | --- |
| Name | NovaPay |
| Icon | wallet |
| Color | 245 |
| Description | Payments and financial risk arm of the group. |

**Domains**

| Name | Color | Description |
| --- | --- | --- |
| Payments & Billing | 215 | Money in, money out, invoicing and subscriptions. |
| Risk & Compliance | 346 | Financial crime, compliance and trust. |

**Teams**

| Team Name | Queue Key | Tribe | Domain | Description | Applications | Keywords | Icon | Color | Channel | Team Lead | On-call |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Payment Webhooks | PAY-WHK | Acceptance | Payments & Billing | Merchant-facing payment event callbacks, webhook signatures, delivery retries and event replay after a transaction succeeds or fails. | Merchant Event Relay, Webhook Delivery Console | webhook not received, callback signature, event replay, duplicate payment callback | globe |  | #pay-webhooks |  | webhooks-oncall |
| Merchant Onboarding | PAY-MOB | Acceptance | Payments & Billing | Business registration, merchant account activation, KYB company documents and payment capability setup for businesses joining NovaPay. | Merchant Signup, Business Verification Portal | merchant activation, kyb, company registration documents, business account pending | wallet |  | #pay-merchant-onboarding |  |  |
| Payment Tokenization | PAY-TOK | Acceptance | Payments & Billing | Saved-card vault, network payment tokens and card updater lifecycle. Owns invalid stored payment tokens and replacement-card updates. | Card Vault, Network Token Service | saved card, invalid payment token, card updater, network token expired | card |  | #pay-tokenization |  | tokenization-oncall |
| Checkout | PAY-CHK | Acceptance | Payments & Billing | Hosted checkout, card forms, Apple Pay and Google Pay buttons. | Checkout Web, Pay SDK | payment failed, checkout error, apple pay, 3ds | cart |  | #pay-checkout | Mara Kis | pay-checkout-oncall |
| Card Processing | PAY-CRD | Acceptance | Payments & Billing | Card authorization, capture and acquirer connections. | AuthGateway | declined card, authorization, acquirer | card |  | #card-processing | Thomas Peeters | cards-oncall |
| Alt Payment Methods | PAY-APM | Acceptance | Payments & Billing | iDEAL, Bancontact, SEPA debit and other local payment methods. | APM Connect | ideal, bancontact, sepa, local payment | wallet |  | #apm |  |  |
| Payment Routing | PAY-RTE | Acceptance | Payments & Billing | Smart routing of transactions across processors for cost and success rate. | Route Optimizer | routing, success rate, retry logic | globe |  |  | Ádám Nagy |  |
| Terminal & POS | PAY-POS | Acceptance | Payments & Billing | In-store card terminals, terminal fleet management and POS integrations. | Terminal OS, Fleet Manager | terminal offline, pos, card reader | terminal |  | #pos-terminals |  | pos-oncall |
| Refunds | PAY-RFD | Money Movement | Payments & Billing | Full and partial refunds to the original payment method after a merchant approves a customer refund. Owns refund status and refund execution failures. | Refund Engine, Refund Status API | refund pending, partial refund, money back, refund rejected | wallet |  | #pay-refunds |  | refunds-oncall |
| Bank Account Verification | PAY-BAV | Money Movement | Payments & Billing | Verification of merchant beneficiary bank accounts before payout eligibility, including IBAN ownership checks and microdeposit confirmation. | Beneficiary Verify | iban ownership, microdeposit, beneficiary name mismatch, bank account verification | bank |  | #pay-bank-verification |  |  |
| Payouts | PAY-OUT | Money Movement | Payments & Billing | Merchant payouts, payout scheduling and bank transfer execution. | Payout Engine | payout delayed, bank transfer, missing payout | bank |  | #payouts | Inès Dubois | payouts-oncall |
| Treasury Ops | PAY-TRS | Money Movement | Payments & Billing | Internal ledger, balance management and liquidity monitoring. | Ledger Core | ledger, balance mismatch, liquidity | bank |  |  | Rik van den Berg |  |
| FX & Settlement | PAY-FXS | Money Movement | Payments & Billing | Currency conversion rates and cross-border settlement files. | FX Rates API | exchange rate, settlement, currency | globe |  | #fx-settlement |  |  |
| Reconciliation | PAY-REC | Money Movement | Payments & Billing | Matching processor reports against the internal ledger, exception queues. | Recon Workbench | reconciliation, mismatch, missing transaction | filter |  |  | Zsófia Tóth |  |
| Merchant Pricing | PAY-PRC | Billing | Payments & Billing | Contracted processing fee schedules, interchange-plus markup and volume pricing tiers applied to merchant transactions. | Merchant Fee Calculator, Pricing Rules Console | processing fee, interchange markup, merchant pricing tier, contract rate | receipt |  | #pay-pricing |  |  |
| Merchant Payment Reporting | PAY-RPT | Billing | Payments & Billing | Merchant-facing transaction statements, payment history filters and downloadable transaction CSV exports in the NovaPay dashboard. | Merchant Statements, Transaction Export API | merchant statement, transaction csv, payment history export, dashboard download | receipt |  | #pay-reporting |  |  |
| Subscriptions | PAY-SUB | Billing | Payments & Billing | Recurring billing plans, upgrades, downgrades and trial logic. | Billing Core | subscription, plan change, trial, renewal | receipt |  | #subscriptions | Emma Claes |  |
| Invoicing | PAY-INV | Billing | Payments & Billing | Invoice generation, credit notes and PDF documents. | Invoice Service | wrong invoice, credit note, invoice pdf | receipt |  | #invoicing |  | billing-oncall |
| Dunning & Collections | PAY-DUN | Billing | Payments & Billing | Failed payment retries, dunning emails and debt collection handoff. | Dunning Flow | retry, overdue, collections | mail |  |  | Hugo Lambert |  |
| Tax Engine | PAY-TAX | Billing | Payments & Billing | VAT and sales tax calculation and tax rate management. | Tax Calc | vat, tax rate, tax exempt | doc |  | #tax-engine |  |  |
| Transaction Limits | RISK-LIM | Financial Crime | Risk & Compliance | Per-transaction amount caps, daily spending ceilings and payment velocity counters that enforce approved merchant and customer limits. | Limits Engine | daily spending limit, velocity counter, transaction cap, limit reset | filter |  | #risk-limits |  | limits-oncall |
| Dispute Evidence Collection | RISK-EVD | Financial Crime | Risk & Compliance | Receipt upload, proof-of-delivery attachments and evidence bundle assembly inside the merchant dispute portal before analyst submission. | Evidence Collector, Dispute Attachment Store | evidence upload, receipt attachment, proof of delivery, evidence bundle | receipt |  | #risk-evidence |  |  |
| Fraud Ops Tooling | RISK-FRO | Financial Crime | Risk & Compliance | Case management and review queues for fraud analysts. | CaseDesk | fraud case, manual review, blocked account | shield |  | #fraud-ops | Gábor Szűcs |  |
| AML Screening | RISK-AML | Financial Crime | Risk & Compliance | Transaction monitoring rules and suspicious activity reports. | AML Monitor | aml, transaction monitoring, sar | eye |  | #aml |  | aml-oncall |
| Disputes & Chargebacks | RISK-DIS | Financial Crime | Risk & Compliance | Chargeback intake, evidence submission and dispute lifecycle. | DisputeFlow | chargeback, dispute, refund abuse | card |  | #disputes | Lotte Hendriks |  |
| Sanctions & Watchlists | RISK-SAN | Financial Crime | Risk & Compliance | Sanctions list screening for customers and payments. | Screener | sanctions, watchlist, pep | flag |  |  |  | sanctions-oncall |
| Merchant Underwriting | RISK-UWR | Compliance | Risk & Compliance | Business risk assessment, merchant underwriting decisions, rolling reserve percentages and restricted business category reviews. | Underwriting Workbench | rolling reserve, underwriting review, restricted business category, merchant risk assessment | filter |  | #risk-underwriting |  |  |
| Regulatory Reporting | RISK-REG | Compliance | Risk & Compliance | Reports to financial regulators and license obligations. | RegReport | regulator, psd2 report, filing | doc |  |  | Margit Oláh |  |
| Privacy Engineering | RISK-PRV | Compliance | Risk & Compliance | GDPR tooling: data subject requests, consent and retention. | PrivacyDesk, Consent SDK | gdpr, delete my data, dsar, consent banner | lock |  | #privacy | Julie Lemaire |  |
| Audit & Controls | RISK-AUD | Compliance | Risk & Compliance | Internal controls testing, SOC2 evidence and audit tooling. | ControlHub | soc2, audit evidence, control | doc |  | #audit |  |  |
| Model Risk Governance | RISK-MRG | Compliance | Risk & Compliance | Validation and approval workflow for risk and ML models. | ModelRegistry | model validation, model approval | settings |  |  |  |  |
| Content Moderation | RISK-MOD | Trust | Risk & Compliance | User content review tooling and moderation policies. | ModQueue | reported content, moderation, abuse report | eye |  | #moderation | Sam Peeters |  |
| Account Security | RISK-ACS | Trust | Risk & Compliance | Account takeover defense, suspicious login detection and lockouts. | ATO Shield | account hacked, suspicious login, locked out, 2fa bypass | lock |  | #account-security |  | acctsec-oncall |
| Bot & Abuse Defense | RISK-BOT | Trust | Risk & Compliance | Bot detection, rate abuse and scraping protection. | BotWall | bot, captcha, scraping | bot | 15 | #bot-defense | Yusuf Demir |  |

**Links**

| Source Key | Target Key | Reason |
| --- | --- | --- |
| PAY-CHK | DATA-FRM | fraud scoring at checkout |
| PAY-CHK | PAY-RTE | routing decisions |
| PAY-CRD | PAY-REC | processor reports |
| PAY-OUT | PAY-TRS | ledger postings |
| PAY-SUB | PAY-INV | invoice on renewal |
| PAY-DUN | CG-NTF | dunning emails |
| PAY-INV | PAY-TAX | tax lines |
| RISK-ACS | PLT-IAM | lockout signals |
| RISK-DIS | PAY-CRD | chargeback data |
| RISK-PRV | DATA-CAT | retention policies |
| RISK-REG | PAY-TRS | liquidity reports |
```

### Lumen Commerce

38 teams. Copy this block into the **Lumen Commerce** Confluence page.

```markdown
**Company config**

| Key | Value |
| --- | --- |
| Name | Lumen Commerce |
| Icon | cart |
| Color | 315 |
| Description | Consumer commerce and growth arm of the group. |

**Domains**

| Name | Color | Description |
| --- | --- | --- |
| Customer & Growth | 262 | Acquisition, onboarding and engagement of customers. |
| Data & Intelligence | 152 | Data platform, analytics and machine learning. |

**Teams**

| Team Name | Queue Key | Tribe | Domain | Description | Applications | Keywords | Icon | Color | Channel | Team Lead | On-call |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Product Catalog | CG-CAT | Acquisition | Customer & Growth | Authoritative product records, SKU attributes, product images and category publication to the storefront. | Product Information Manager, Catalog Publish API | sku attribute, product image missing, category publication, product record | cart |  | #commerce-catalog |  |  |
| Delivery Promises | CG-ETA | Acquisition | Customer & Growth | Estimated arrival dates and shipping service eligibility shown before purchase, using postcode coverage and carrier cutoff calendars. | Delivery Promise API, Carrier Cutoff Calendar | estimated arrival date, shipping cutoff, postcode coverage, next day delivery promise | globe |  | #commerce-delivery-promises |  |  |
| SEO & Content Platform | CG-SEO | Acquisition | Customer & Growth | Owns the public website CMS, landing content and search ranking tooling. | Website CMS, Sitemap Service | seo, blog, meta tags, website content | search |  | #growth-seo | Eszter Farkas |  |
| Performance Marketing Tech | CG-PMT | Acquisition | Customer & Growth | Ad platform integrations, conversion tracking pixels and campaign attribution. | AdSync, Attribution API | google ads, pixel, utm, attribution | megaphone |  | #perf-marketing | Lucas Meyer |  |
| Referrals & Incentives | CG-REF | Acquisition | Customer & Growth | Referral links, promo codes and signup incentive campaigns. | Promo Engine | promo code, referral, voucher, discount | gift |  | #referrals |  |  |
| Landing Experience | CG-LND | Acquisition | Customer & Growth | Public landing pages, A/B page variants and pricing pages. | Landing Builder | landing page, pricing page, hero | flag |  |  | Noor van Dijk |  |
| Mobile Growth | CG-MOB | Acquisition | Customer & Growth | App store listings, deep links and install attribution for mobile apps. | DeepLink Router | app store, deep link, install | phone |  | #mobile-growth | Petra Molnár |  |
| Marketplace Sellers | CG-SLR | Onboarding | Customer & Growth | Third-party seller registration, marketplace storefront approval, seller permissions and bulk offer upload in the seller portal. | Seller Center, Offer Upload API | seller portal, bulk offer upload, marketplace approval, seller permissions | cart |  | #commerce-sellers |  |  |
| Consent Preferences | CG-CNS | Onboarding | Customer & Growth | Customer cookie consent choices, newsletter opt-out propagation and channel preference center synchronization. | Consent Ledger, Preference Center | cookie consent, unsubscribe ignored, newsletter opt out, communication preferences | filter |  | #commerce-consent |  |  |
| Identity Onboarding | CG-IDO | Onboarding | Customer & Growth | Signup, login and account creation flows for new customers. | Signup Web, Auth Screens | signup, registration, cannot log in, account creation | users |  | #onboarding-identity | Julien Caron | cg-identity-oncall |
| KYC Orchestration | CG-KYC | Onboarding | Customer & Growth | Identity document checks and verification vendor orchestration during onboarding. | KYC Flow, DocScan Bridge | kyc, id verification, document upload, selfie check | eye |  | #kyc | Sanne de Vries | kyc-oncall |
| Address & Verification | CG-ADR | Onboarding | Customer & Growth | Address lookup, phone and email verification services. | Verify API | address lookup, sms code, email verification, otp | map |  | #verification |  |  |
| Activation Journeys | CG-ACT | Onboarding | Customer & Growth | First-run product tours, checklists and activation nudges. | Journey Engine | product tour, activation, first run | zap |  |  | Bence Szabó |  |
| Inventory Availability | CG-STK | Engagement | Customer & Growth | Sellable stock counts, warehouse inventory reservations and overselling prevention when customers place orders. | Stock Ledger, Reservation API | overselling, stock reservation, sold out, inventory count | cart |  | #commerce-inventory |  | inventory-oncall |
| Order Management | CG-ORD | Engagement | Customer & Growth | Order creation after payment confirmation, order state transitions, cancellation orchestration and fulfillment handoff. | Order Hub, Order Lifecycle API | order not created, paid but no order, cancel order, order state stuck | cart |  | #commerce-orders |  | orders-oncall |
| Shipment Tracking | CG-SHP | Engagement | Customer & Growth | Parcel tracking after dispatch, carrier scan ingestion and shipment tracking links displayed in the customer order page. | Parcel Timeline, Carrier Scan Adapter | tracking link, parcel scan missing, shipment status, package not moving | globe |  | #commerce-shipment-tracking |  |  |
| Returns Experience | CG-RTN | Engagement | Customer & Growth | Return merchandise authorization, return eligibility, printable return labels and warehouse receipt of returned items before refund approval. | Returns Portal, Return Label Service | return label, rma, return eligibility, returned item receipt | cart |  | #commerce-returns |  |  |
| Product Reviews | CG-REV | Engagement | Customer & Growth | Verified-purchase review submission, star rating aggregation and publication of approved product reviews on product detail pages. | Reviews API, Rating Aggregator | star rating, verified purchase review, review submission, rating average | filter |  | #commerce-reviews |  |  |
| Notifications | CG-NTF | Engagement | Customer & Growth | Email, SMS and push notification delivery platform for all product teams. | Notify API, Template Studio | email not received, push notification, sms delivery, unsubscribe | bell |  | #notifications | Camille Roux | notify-oncall |
| Personalization | CG-PRS | Engagement | Customer & Growth | Home feed ordering, content targeting and audience segments. | Segment Service | personalization, targeting, segments | spark |  |  | Dávid Kovács |  |
| Loyalty & Rewards | CG-LOY | Engagement | Customer & Growth | Points, tiers and reward redemption features. | Rewards Hub | points missing, rewards, loyalty tier | gift | 95 | #loyalty |  |  |
| CRM Tooling | CG-CRM | Engagement | Customer & Growth | Campaign builder and customer messaging tools for marketing teams. | Campaign Studio | campaign, newsletter, audience export | megaphone |  |  | Femke Jansen |  |
| In-App Messaging | CG-IAM2 | Engagement | Customer & Growth | Banners, modals and inbox messages inside the product. | InApp SDK | banner, in-app message, announcement | mail |  | #inapp-messaging |  |  |
| Ingestion Pipelines | DATA-ING | Data Platform | Data & Intelligence | Batch and CDC pipelines landing source data into the lake. | PipeRunner | pipeline failed, ingestion, cdc, data late | filter |  | #data-ingestion | Nóra Szilágyi | data-ing-oncall |
| Data Lake | DATA-LKE | Data Platform | Data & Intelligence | Lakehouse storage, table formats and compute clusters. | Lakehouse | table missing, spark, warehouse | db |  | #data-lake |  |  |
| Streaming | DATA-STR | Data Platform | Data & Intelligence | Kafka platform, stream processing and event schemas. | Kafka Fleet, Schema Registry | kafka lag, topic, event schema | zap |  | #streaming |  | streaming-oncall |
| Data Catalog & Governance | DATA-CAT | Data Platform | Data & Intelligence | Dataset discovery, ownership, lineage and access requests. | Catalog | data access request, lineage, dataset owner | doc |  |  | Elise Peters |  |
| Data Quality | DATA-DQ | Data Platform | Data & Intelligence | Quality checks, anomaly alerts and data contracts. | DQ Monitor | data quality, broken dashboard numbers, contract | eye |  | #data-quality |  |  |
| Customer Segmentation | DATA-SEG | Analytics | Data & Intelligence | Computed customer cohort membership, audience eligibility rules and scheduled segment refresh for downstream campaign consumers. | Audience Builder, Cohort Refresh Worker | segment membership, cohort refresh, audience eligibility, customer cohort | filter |  | #data-segmentation |  |  |
| BI & Reporting | DATA-BI | Analytics | Data & Intelligence | Company dashboards, self-serve BI tool and certified reports. | BI Studio | dashboard broken, report access, kpi | chart |  | #bi-reporting | Pauline Girard |  |
| Experimentation | DATA-EXP | Analytics | Data & Intelligence | A/B testing platform, assignment and stats engine. | ExpPlatform | ab test, experiment, feature flag stats | settings |  |  | Balázs Varga |  |
| Product Analytics | DATA-PA | Analytics | Data & Intelligence | Event tracking plan, SDKs and funnel analysis tooling. | Track SDK, Funnels | tracking missing, events, funnel | chart |  | #product-analytics |  |  |
| Forecasting | DATA-FC | Analytics | Data & Intelligence | Demand and revenue forecasting models for planning. | ForecastLab | forecast, projection | spark |  |  | Willem Smit |  |
| ML Platform | DATA-MLP | Machine Learning | Data & Intelligence | Model training, feature store and model serving infrastructure. | MLFlow Stack, FeatureStore | model deploy, feature store, gpu | bot |  | #ml-platform |  | mlp-oncall |
| Recommendations | DATA-REC | Machine Learning | Data & Intelligence | Product and content recommendation models. | RecoServe | recommendations wrong, ranking | spark |  |  | Anna Kelemen |  |
| Fraud Models | DATA-FRM | Machine Learning | Data & Intelligence | Real-time fraud scoring models for payments and signups. | FraudScore | false positive, fraud score, model threshold | shield |  | #fraud-models |  | fraud-models-oncall |
| GenAI Enablement | DATA-GEN | Machine Learning | Data & Intelligence | LLM gateway, prompt tooling and AI feature guidelines. | LLM Gateway | llm, ai feature, prompt, copilot | bot | 305 | #genai | Maarten Bos |  |
| Search Relevance | DATA-SRC | Machine Learning | Data & Intelligence | Product search indexing, ranking and typo tolerance. | SearchCore | search results wrong, no results, indexing | search |  | #search |  |  |

**Links**

| Source Key | Target Key | Reason |
| --- | --- | --- |
| CG-IDO | PLT-IAM | auth tokens |
| CG-IDO | CG-KYC | verification handoff |
| CG-KYC | RISK-SAN | screening at onboarding |
| CG-NTF | OPS-CCT | support alert routing |
| CG-CRM | CG-NTF | campaign sends |
| CG-PRS | DATA-REC | reco models |
| CG-ACT | DATA-EXP | journey experiments |
| DATA-FRM | RISK-FRO | cases from model flags |
| DATA-ING | DATA-DQ | quality gates |
| DATA-BI | DATA-LKE | warehouse tables |
| DATA-MLP | PLT-K8S | training clusters |
| DATA-SRC | CG-PRS | ranked results |
```

### Aurora Shared Services

39 teams. Copy this block into the **Aurora Shared Services** Confluence page.

```markdown
**Company config**

| Key | Value |
| --- | --- |
| Name | Aurora Shared Services |
| Icon | server |
| Color | 190 |
| Description | Platform, infrastructure and internal operations for all group companies. |

**Domains**

| Name | Color | Description |
| --- | --- | --- |
| Core Platform | 183 | Infrastructure, developer experience, reliability and security. |
| Internal Operations | 38 | Employee tech, business systems and support tooling. |

**Teams**

| Team Name | Queue Key | Tribe | Domain | Description | Applications | Keywords | Icon | Color | Channel | Team Lead | On-call |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DNS & Networking | PLT-NET | Runtime | Core Platform | Private DNS zones, VPC routing, peering and network firewall connectivity between cloud networks and office VPN clients. | Network Control Plane, Private DNS Manager | dns lookup, nxdomain, vpc peering, vpn route | globe |  | #platform-networking |  | network-oncall |
| Object Storage | PLT-OBJ | Runtime | Core Platform | Shared blob buckets, object lifecycle policies, presigned download URLs and object storage access policies for application teams. | Blob Gateway, Bucket Policy Controller | bucket access denied, presigned url, blob upload, object lifecycle | bank |  | #platform-object-storage |  | storage-oncall |
| Event Broker Infrastructure | PLT-EVT | Runtime | Core Platform | Kafka broker cluster availability, broker disk capacity, partition replication and topic provisioning for all event producers and consumers. | Broker Operator, Topic Provisioner | broker disk full, under replicated partition, topic provisioning, broker unavailable | terminal |  | #platform-event-brokers |  | brokers-oncall |
| Kubernetes Platform | PLT-K8S | Runtime | Core Platform | Managed Kubernetes clusters, namespaces and workload scheduling. | K8s Fleet, Cluster Portal | pod crash, namespace, cluster, oom | box |  | #k8s-platform | Gergő Horváth | k8s-oncall |
| Service Mesh | PLT-MSH | Runtime | Core Platform | Service-to-service networking, mTLS and traffic policies. | Mesh Control | mtls, service discovery, timeout between services | cloud |  | #service-mesh |  |  |
| Compute & Autoscaling | PLT-CMP | Runtime | Core Platform | VM fleets, autoscaling policies and spot capacity management. | Scaler | autoscaling, capacity, vm | server |  |  | Daan Bakker |  |
| Edge & CDN | PLT-EDG | Runtime | Core Platform | CDN configuration, WAF rules and edge caching. | Edge Config | cdn, cache purge, waf blocked, slow static assets | globe |  | #edge-cdn |  | edge-oncall |
| Database Platform | PLT-DBP | Runtime | Core Platform | Managed Postgres and Redis, backups, replicas and migrations support. | DB Portal | database slow, backup restore, replica lag, migration | db |  | #database-platform | Anouk Visser | db-oncall |
| API Gateway | PLT-API | Runtime | Core Platform | Public API gateway, rate limiting and API key management. | Gateway, API Keys Portal | rate limit, api key, 429, gateway timeout | code |  | #api-gateway |  | gateway-oncall |
| Feature Flag Platform | PLT-FLG | Developer Experience | Core Platform | Runtime feature toggle evaluation, rollout rule propagation, flag SDK availability and emergency kill switches used by product teams. | Toggle Control, Flag Evaluation SDK | feature flag stale, kill switch, rollout rule, toggle evaluation | filter |  | #platform-feature-flags |  | flags-oncall |
| Scheduled Jobs Platform | PLT-JOB | Developer Experience | Core Platform | Shared cron scheduler, durable job dispatch, task lease recovery and scheduling timezone rules for background workloads. | Job Dispatcher, Schedule Console | cron never fired, job lease stuck, scheduler timezone, missed scheduled task | terminal |  | #platform-scheduled-jobs |  |  |
| Service Ownership Catalog | PLT-OWN | Developer Experience | Core Platform | Service-to-team ownership records, repository ownership imports and on-call contact metadata in the internal service directory. | Service Directory, Ownership Importer | service owner missing, repository ownership, stale oncall contact, service directory | search |  | #platform-service-ownership |  |  |
| CI/CD | PLT-CI | Developer Experience | Core Platform | Build pipelines, deploy automation and rollback tooling. | Pipelines, Deployer | deploy failed, pipeline stuck, rollback, build error | zap |  | #ci-cd | Léa Moreau | cicd-oncall |
| Internal Dev Portal | PLT-DEV | Developer Experience | Core Platform | Service catalog, scorecards and golden-path templates for engineers. | DevPortal | service catalog, scaffold, template | map |  | #dev-portal | Tamás Balogh |  |
| Build Tooling | PLT-BLD | Developer Experience | Core Platform | Monorepo build system, caching and dependency management. | BuildCache | monorepo, slow build, dependency | settings |  |  | Jasper Willems |  |
| Test Infrastructure | PLT-TST | Developer Experience | Core Platform | Test runners, flaky test detection and preview environments. | TestGrid, Preview Envs | flaky test, preview environment, e2e | bug |  | #test-infra |  |  |
| Backup & Recovery | PLT-BKR | Reliability | Core Platform | Cross-service disaster recovery plans, immutable backup retention, regional recovery drills and recovery-time evidence for shared infrastructure. | Recovery Vault, Restore Drill Runner | immutable backup, disaster recovery, regional recovery drill, backup retention | bank |  | #platform-recovery |  |  |
| Observability | PLT-OBS | Reliability | Core Platform | Metrics, logging, tracing and dashboards platform. | Metrics Stack, LogSearch | missing logs, dashboard, alert rule, tracing | eye |  | #observability | Chloé Bernard | obs-oncall |
| Incident Tooling | PLT-INC | Reliability | Core Platform | Incident management bot, status page and postmortem tooling. | IncidentBot, StatusPage | incident, status page, postmortem, page down | bell |  | #incident-tooling |  | incident-oncall |
| Chaos & Resilience | PLT-CHA | Reliability | Core Platform | Fault injection, load testing and disaster recovery drills. | ChaosKit | load test, failover, dr drill | zap |  |  | Milan Kovac |  |
| Capacity & Cost | PLT-CAP | Reliability | Core Platform | Cloud cost reporting, budgets and capacity forecasting. | CostBoard | cloud cost, budget alert, capacity planning | chart |  | #finops |  |  |
| AppSec | PLT-SEC | Security Engineering | Core Platform | Security reviews, dependency scanning and vulnerability triage. | VulnTracker | vulnerability, cve, pentest, security review | shield |  | #appsec | Sophie Martin | appsec-oncall |
| Secrets & PKI | PLT-PKI | Security Engineering | Core Platform | Secret storage, certificate issuance and rotation. | Vault, CertIssuer | certificate expired, secret rotation, tls cert | key |  | #secrets-pki |  | pki-oncall |
| IAM Platform | PLT-IAM | Security Engineering | Core Platform | Workforce SSO, customer auth tokens and permission model. | SSO Broker, AuthZ Core | sso, password reset, permissions, access denied, mfa | lock |  | #iam | Marton Fehér | iam-oncall |
| Workforce Provisioning | OPS-JML | Employee Tech | Internal Operations | Employee joiner-mover-leaver automation, SCIM account provisioning and offboarding deactivation triggered by HR lifecycle events. | Lifecycle Automator, SCIM Bridge | new hire account missing, scim provisioning, offboarding deactivation, employee transfer | terminal |  | #ops-workforce-provisioning |  |  |
| Workplace IT | OPS-IT | Employee Tech | Internal Operations | Employee helpdesk, accounts, wifi, printers and office AV. | IT Helpdesk | laptop broken, wifi, printer, new starter account, vpn | headset | 210 | #it-helpdesk | Katalin Papp | it-oncall |
| Collaboration Tools | OPS-COL | Employee Tech | Internal Operations | Slack, Confluence, Jira and Google Workspace administration. | Jira, Confluence, Slack Admin | jira access, confluence permission, slack channel, workspace | users |  | #collab-tools | Ruben Mertens |  |
| Device Management | OPS-DEV | Employee Tech | Internal Operations | Laptop fleet, MDM policies and OS patching. | MDM Console | mdm, os update, disk encryption | phone |  | #device-mgmt |  |  |
| Facilities Tech | OPS-FAC | Employee Tech | Internal Operations | Badge access, meeting room systems and office sensors. | BadgeSys | badge not working, meeting room, desk booking | key |  |  |  |  |
| Payroll Integrations | OPS-PAY | Business Systems | Internal Operations | Payroll provider file transport, salary export mapping and acknowledgement ingestion between HR systems and external payroll processors. | Payroll Connector, Salary Export Worker | payroll export rejected, salary file mapping, payroll provider acknowledgement, payroll connector | receipt |  | #ops-payroll-integrations |  |  |
| ERP & Finance Systems | OPS-ERP | Business Systems | Internal Operations | General ledger ERP, expense tool and month-close automations. | NetSuite, ExpenseApp | expense report, erp, gl code, purchase order | bank |  | #finance-systems | Vera Lakatos |  |
| HR Systems | OPS-HRS | Business Systems | Internal Operations | HRIS, recruiting ATS and payroll integrations. | HRIS, ATS | payslip, time off, onboarding new hire, ats | users |  | #hr-systems | Claire Fontaine |  |
| Procurement Tech | OPS-PRC | Business Systems | Internal Operations | Vendor onboarding, contracts workflow and purchasing approvals. | ProcureFlow | vendor, contract approval, purchasing | cart |  |  |  |  |
| CRM Admin | OPS-CRM | Business Systems | Internal Operations | Salesforce configuration, sales pipelines and quota tooling. | Salesforce | salesforce, opportunity, lead routing | cloud |  | #crm-admin | Pieter Claes |  |
| Legal Tech | OPS-LGL | Business Systems | Internal Operations | Contract lifecycle tooling and e-signature administration. | CLM, eSign | nda, e-signature, contract template | doc |  |  |  |  |
| Support Workforce Scheduling | OPS-WFM | Support Tech | Internal Operations | Support agent shift rosters, staffing forecasts, break allocation and workforce schedule publication to the contact center. | Agent Roster, Staffing Planner | agent shift missing, staffing forecast, break allocation, support roster | terminal |  | #ops-support-scheduling |  |  |
| Ticketing Platform | OPS-TKT | Support Tech | Internal Operations | The internal ticketing system itself: queues, forms and routing rules. | TicketDesk | ticket routing, queue setup, form field, sla config | receipt |  | #ticketing-platform | Orsolya Kiss | ticketing-oncall |
| Knowledge Base | OPS-KB | Support Tech | Internal Operations | Internal and customer help-center content platform. | HelpCenter | help article, faq, kb | doc |  | #knowledge-base |  |  |
| Contact Center Tech | OPS-CCT | Support Tech | Internal Operations | Support telephony, chat widget and agent workspace. | AgentDesk, Chat Widget | call center, support chat, ivr, agent tools | headset |  | #contact-center | Amélie Rousseau | cct-oncall |

**Links**

| Source Key | Target Key | Reason |
| --- | --- | --- |
| PLT-CI | PLT-K8S | deploy targets |
| PLT-OBS | PLT-INC | alerts to incidents |
| PLT-API | PLT-MSH | traffic policies |
| PLT-PKI | PLT-EDG | edge certificates |
| OPS-TKT | OPS-COL | jira sync |
| OPS-CCT | OPS-KB | agent answers |
| OPS-ERP | PAY-TRS | gl reconciliation |
```

<!-- AURORA_TABLES_END -->

After creating the pages, set `CONFLUENCE_PAGE_IDS` to their actual numeric IDs in NovaPay, Lumen Commerce, Aurora Shared Services order, and set `MOCK_CONFLUENCE=false`. Configure `GROUP_NAME=Aurora Group`, `GROUP_ICON=globe`, and `GROUP_HUE=262` for the group root. The page IDs in the seed are fictional examples, not pages to reuse. See [Confluence setup](docs/CONFLUENCE_SETUP.md) for credentials and the strong sync token requirement.

### Routing demo questions

Use these in Ask Orbit after syncing. They intentionally distinguish adjacent responsibilities rather than relying only on team names. The full offline retrieval evaluation is in [golden.jsonl](apps/services/assistant-service/eval/golden.jsonl); `make eval` checks top-3 retrieval, not live LLM answer quality.

| Ticket question | Expected queue | Ownership distinction |
|---|---|---|
| A return label printed correctly but an approved refund has been pending for a week. | PAY-RFD | Refund execution rather than return logistics (CG-RTN). |
| A customer cannot print the return label after their RMA was approved. | CG-RTN | Return authorization and labels rather than moving money (PAY-RFD). |
| Payment succeeded but our merchant callback endpoint never received its webhook. | PAY-WHK | Callback delivery rather than card authorization (PAY-CRD). |
| The payment webhook says success but the order state is stuck before fulfillment handoff. | CG-ORD | Order lifecycle rather than callback transport (PAY-WHK). |
| Kafka broker disks are full and partitions are under replicated across the cluster. | PLT-EVT | Broker infrastructure rather than streaming consumer pipelines (DATA-STR). |
| Kafka brokers are healthy but the orders topic consumer lag keeps growing in the streaming pipeline. | DATA-STR | Consumer processing rather than broker infrastructure (PLT-EVT). |
| An employee was offboarded in HR yesterday but SCIM never deactivated their accounts. | OPS-JML | Workforce lifecycle automation rather than SSO authentication (PLT-IAM). |
| The external payroll provider rejected the salary export because its file mapping changed. | OPS-PAY | Payroll integration rather than employee HR portal features (OPS-HRS). |
| The newsletter delivered messages to customers who opted out in their consent preferences. | CG-CNS | Consent propagation rather than notification transport (CG-NTF). |
| The merchant dispute portal refuses to attach proof of delivery to the evidence bundle. | RISK-EVD | Evidence collection rather than analyst submission (RISK-DIS). |

For the local Docker mock stack, the seed is baked into the registry image. Rebuild only that service after changing the fixture, then use the app's authenticated Refresh action to replace the existing snapshot and notify the assistant to reindex. Restarting alone may skip ingestion when a previous successful snapshot exists.

## Screenshots

_Placeholder — add after first deploy._

## Testing

```bash
make test              # unit tests, all packages
make test-integration  # services against dockerized postgres + redis
make eval              # RAG retrieval accuracy vs eval/golden.jsonl (top-3 ≥ 90% gate)
```
