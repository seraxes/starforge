# Platform layers — Core, Modules, Hero

**Decision (2026-11-03):** Starforge has three layers. Shared engines (Forms, Media, Events, Maps, Chat, …) are **Modules**, not “ASN-only code.” ASN (and other sites) live in **Hero**: theme + unique business logic on top of Modules — **not** forks of those modules. Build order: finish **Core** spine first; ship heavy Modules later as optional toggles — not one megamodule monolith.

## Rule of thumb

| Layer | Put it here when… |
| --- | --- |
| **Core** | Skeleton / host / **ports** every app needs to **boot** (auth session, layout host, module loader, Mailer/cache/storage/LLM/map/payments *adapters*) |
| **Modules** | Reusable **product features** any Starforge site can toggle on/off (`starforge.modules.json` + Site Settings) |
| **Hero** | **Brand theme** + **unique business rules** / custom workflows / processes on top of Modules — never a parallel copy of a Module |

**Ports** = thin Core adapters (env secrets, factory pick). **Modules** *use* ports; they do not own vendor SDKs. **Hero** skins and rules Modules — it does not fork them.

## Three layers (summary)

| Layer | Owns | Examples |
| --- | --- | --- |
| **1. Core** | App skeleton / *váz* — always-on host + ports | Auth, Users/Groups ACL, Layout/Nav/Chrome host, Payload pages host, Module Manager, env overlay; ports: Mailer, Redis/cache, MediaStorage, MapProvider, LlmProvider, Payments, MediaAnalysis |
| **2. Modules** | Toggleable reusable packs | Forms, Media (+ tags/pipeline), Posts/Search, Consent, Redirects/sitemap, Profiles, Social, Chat, Stream, Marketplace/Shop, Ads, Events/venues, Maps/location, Notifications |
| **3. Hero** | Theme + unique rules/workflows — not a Module fork | **Starforge theme:** pastel orange + blue. **ASN theme:** dark, tactical, gaming, military. Plus ASN team/RP/airsoft domain, catalog fees, quality-check **apps** that *call* Media analysis hooks |

## Placement guide

| Capability | Layer | Notes |
| --- | --- | --- |
| **Auth** (session, 2FA, passwordless) | **Core** | Better Auth platform; every site boots with it |
| **Layout / Nav / Chrome** | **Core** | Gantry-like host + Site Chrome; particles may come from Modules |
| **Module Manager / allowlist** | **Core** | Host that loads Modules |
| **Redis / cache** | **Core (port)** | `PublishedContentCache` (+ later rate-limit/queues); not a product Module |
| **Mailer** | **Core (port)** | console / SMTP / Resend adapters; Modules call `send()` |
| **Payments** | **Core (port)** + **`product:payments` module** | Core: gateway/fiscal adapters + secrets (Mailer-like). Module: cart, orders, VAT invoices, admin — Events/Shop/Subscriptions/Ads consume `@/modules/payments/api` only |
| **LlmProvider** | **Core (port)** | Optional complete() for Events AI draft (and later others); Mailer-like adapters |
| **MapProvider** | **Core (port)** | Tiles/geocode adapters; Maps Module consumes |
| **MediaStorage** (local → Spaces/S3) | **Core (port)** | Storage swap only — not a second media DB |
| **MediaAnalysisPort** (OCR / vision hooks) | **Core (port)** | Pluggable analyzers; Media Module triggers; results on same Media rows |
| **Media** (+ tags/categories, sharp/ffmpeg pipeline, library UI) | **Modules** | One Payload library; taxonomy/ACL same files; uses MediaStorage + optional MediaAnalysis |
| **Forms** (+ presets, conditional/math) | **Modules** | Shared intake; contact/survey/ticket/**event registration** presets |
| **Posts / Search / taxonomy** | **Modules** | Content + findability; shared tags with Media |
| **Profiles** | **Modules** | Generic profile/avatar/privacy; Hero adds vertical fields |
| **Social / feed skins** | **Modules** | Follow/friend/feed; FB-like vs short-video = layout/particle options on **one** Social Module — Hero only brands |
| **Chat** | **Modules** | DM/group/media; uses **RealtimePort** for live messages; RTC port later on Core when calls ship |
| **RealtimePort** (SSE → Redis fanout) | **Core (port)** | Shared push bus; Notifications / Chat / live Maps consume — not per-module WebSocket stacks |
| **Stream** | **Modules** | Ingest/playback + ACL |
| **Marketplace / Shop** | **Modules** | Listings/SKUs; checkout via **`product:payments`** (Core Payments port for gateways) |
| **Payments (commerce)** | **Modules** | `product:payments` — shared cart/orders/VAT; never fork Forms/Email/Media |
| **Ads** | **Modules** | Placements + campaign CRUD |
| **Events / venues / booking** (+ AI description assist) | **Modules** | Generic venue/event + Form registration; AI assist calls **LlmProvider** port — not Hero-only |
| **Maps / location sharing** | **Modules** | Privacy scopes + particle; uses **MapProvider** port; mobile client later |
| **Consent** | **Modules** | Cookie/privacy banner particle |
| **Redirects / sitemap** | **Modules** (or thin Core SEO helpers) | Redirects CRUD + middleware; sitemap over published pages |
| **Notifications** (in-app) | **Modules** | Bell/center when needed; persist + `RealtimePort.publish` on create; transactional email stays Mailer port |
| **Starforge public theme** (pastel orange/blue) | **Hero** (default brand) *or* default tokens | Public site — pastel orange + blue |
| **Starforge admin / backend** | **Core** chrome (theme port) | Blue-dominated high-tech minimalist; orange = accent only |
| **ASN theme** (dark tactical / gaming / military) | **Hero** | Visual only — not pastel Starforge; consumes Layout + admin-theme port |
| **ASN team / RP / airsoft domain** | **Hero** | Unique rules, workflows, ACL policies, catalog fees — on top of Modules |
| **Quality-check AI apps** (photo QA, OCR apps, …) | **Hero** (apps) + **Core port** | Apps/workflows live in Hero (or external); they **plug into** `MediaAnalysisPort` — do not fork Media |

### Quick tests

- Reusable admin + data model without saying “airsoft”? → **Module** (or Core port if every boot needs it).
- Theme, fee table, milsim sheet, custom approval process? → **Hero**.
- Vendor SDK / API key / Redis client? → **Core port** + env; Module only calls the interface.

Form engine stays the shared intake path — other Modules do not rebuild fields ([preferences](../preferences.md)).

## Build order (locked)

1. **Core** — make it excellent, but **agile**: thin solid ports and host, iterate; no big-bang perfection.
2. **Modules** — think through behavior, then build toggleable packs on Core ports.
3. **Hero** — unique business logic / features / theme **only on** Core + Modules; no Hero shortcuts that bypass unfinished ports.

### Commercial priority (within Modules)

Revenue floor — build **`product:payments`**, then wire consumers on the same API: **subscriptions**, **Events tickets**, **Ads**. **Shop** (incl. shipping quotes) later. **Marketplace** reuses payments + domain packs (e.g. highlight via subscriptions); never a second cart. Ownership map: [sf-module-ownership](../../../.cursor/rules/sf-module-ownership.mdc), [payments-cart-plan](./payments-cart-plan.md).

## What this does *not* change now

- **Immediate build target** remains Core spine + Forms/Media/Redis/SEO gaps ([core-modules-inventory](./core-modules-inventory.md)).
- Do **not** start Chat/Stream/Shop packs until Core ports are real (Redis, Spaces, security headers).
- Feed layout variants = Social **Module** + Layout options; Hero **theme** brands them — still one Social Module.
- Voice/video calling = later optional RTC **port** on Chat — decide when Chat ships.

## Related

- [modular-core](../principles/modular-core.md)
- [core-modules-inventory](./core-modules-inventory.md)
- [media-pipeline-plan](./media-pipeline-plan.md)
- [events-manager-plan](./events-manager-plan.md)
- [maps-location-plan](./maps-location-plan.md)
- [form-feature-gap-analysis](./form-feature-gap-analysis.md)
