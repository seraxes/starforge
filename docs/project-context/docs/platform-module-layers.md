# Platform layers — Core, base, advanced, Hero

**Decision (2026-11-03, tiers sharpened 2026-11-14):** Starforge has a Core host, toggleable modules, and a Hero on top. Modules split by dependency, not by folder: **base** engines are what other packs `require`; **advanced** packs are the domain products that depend on them. ASN (and other sites) live in **Hero**: theme + unique business logic — **not** forks of those modules. Rule: [sf-architecture](../../../.cursor/rules/sf-architecture.mdc).

## Rule of thumb

| Placement | Put it here when… |
| --- | --- |
| **Core** | Skeleton / host / **ports** every app needs to **boot** (auth session, layout host, module loader, Mailer/cache/storage/LLM/map/payments *adapters*). Not a `requires` id. |
| **Base module** | Shared engine other packs list in `requires` (Forms, Media, Email Manager, Payments, Profiles, Maps, Rich editor). A base pack may require another base pack. |
| **Advanced module** | Domain product whose manifest `requires` names those base packs (Events, Subscriptions, and later Ads, Shop, Marketplace, Support, Stream). |
| **Hero** | **Brand theme** + **unique business rules** / custom workflows on top of modules — never a parallel copy of a module. |

**Ports** = thin Core adapters (env secrets, factory pick). **Modules** use ports; they do not own vendor SDKs. **Hero** skins and rules modules — it does not fork them. The old queue nickname “level-1 engines” means these **base modules**, not Core.

## Four placements (summary)

| Placement | Owns | Examples |
| --- | --- | --- |
| **Core** | Always-on host + ports | Auth, Users/Groups ACL, Layout/Nav/Chrome, Module Manager, env overlay; ports: Mailer, Redis/cache, MediaStorage, MapProvider, LlmProvider, Payments adapters, PageReadsPort, MediaAnalysis |
| **Base modules** | Dependency engines | Media, Forms, Rich editor, Email Manager, Payments (cart/orders/VAT), Profiles, Maps. Payload = content-manager pack behind `PageReadsPort` (pages only; media stays `product:media`) |
| **Advanced modules** | Domain products that `require` base packs | Events, Subscriptions; later Ads, Shop, Marketplace, Support, Stream, Social, Chat |
| **Hero** | Theme + unique rules — not a module fork | **Starforge theme:** pastel orange + blue. **ASN theme:** dark, tactical, gaming, military. Plus ASN team/RP/airsoft domain, catalog fees, ASN currency, quality-check **apps** that *call* Media analysis hooks |

Site packs (Consent, Redirects, Search, PWA, Lexical, Notice bar) stay optional modules. They are not Core and not a domain product.

Rows in the placement guide below that still say **Modules** mean one of: base, advanced, or site pack. Use the test in `sf-architecture.mdc` when adding a row.

## Placement guide

| Capability | Layer | Notes |
| --- | --- | --- |
| **Auth** (session, 2FA, passwordless) | **Core** | Better Auth platform; every site boots with it |
| **Layout / Nav / Chrome** | **Core** | Gantry-like host + Site Chrome; particles may come from Modules |
| **Module Manager / allowlist** | **Core** | Host that loads Modules |
| **Redis / cache** | **Core (port)** | `PublishedContentCache` (+ later rate-limit/queues); not a product Module |
| **Mailer** | **Core (port)** | console / SMTP / Resend adapters; Modules call `send()` |
| **Payments** | **Core (port)** + **base `product:payments`** | Core: gateway/fiscal adapters + secrets (Mailer-like). Base module: cart, orders, VAT invoices, admin — Events/Shop/Subscriptions/Ads consume `@/modules/payments/api` only |
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
- Vendor SDK / site-wide API key / Redis client? → **Core port** + env; Module only calls the interface.
- Per-merchant payment keys? → encrypted table in `product:payments`, not the env file and not a second gateway UI. See [architecture-current](./architecture-current.md).

Form engine stays the shared intake path — other Modules do not rebuild fields ([preferences](../preferences.md)).

## Build order (locked)

1. **Core** — make it excellent, but **agile**: thin solid ports and host, iterate; no big-bang perfection.
2. **Base modules** — shared engines other packs `require`, on those ports.
3. **Advanced modules** — domain packs that list the base ids in `requires`.
4. **Hero** — unique business logic / features / theme **only on** Core + modules; no Hero shortcuts that bypass unfinished ports.

### Commercial priority (within Modules)

Revenue floor — build **`product:payments`**, then wire consumers on the same API: **subscriptions**, **Events tickets**, **Ads**. **Shop** (incl. shipping quotes) later. **Marketplace** reuses payments + domain packs (e.g. highlight via subscriptions); never a second cart. Ownership map: [sf-module-ownership](../../../.cursor/rules/sf-module-ownership.mdc), [payments-cart-plan](./payments-cart-plan.md).

## What to build next

The Core spine this section used to protect is in place, and it is **not** the signal to start the next pack. Live queue: [architecture-current](./architecture-current.md) — finish and polish Core first. After that, paid event tickets, then subscriptions, then ads. Chat, Stream, Shop, Social, and Marketplace schema stay parked.

- Feed layout variants = Social **Module** + Layout options; Hero **theme** brands them — still one Social Module, when Social is actually started.
- Voice/video calling = later optional RTC **port** on Chat — decide when Chat ships.
- TacMap rooms/teams/GPS stay in `product:maps`. Stations, beacons, and `apps/asn-capacitor` wait until Core is finished, and they are not ahead of the commercial packs.

## Related

- [modular-core](../principles/modular-core.md)
- [core-modules-inventory](./core-modules-inventory.md)
- [media-pipeline-plan](./media-pipeline-plan.md)
- [events-manager-plan](./events-manager-plan.md)
- [maps-location-plan](./maps-location-plan.md)
- [form-feature-gap-analysis](./form-feature-gap-analysis.md)
