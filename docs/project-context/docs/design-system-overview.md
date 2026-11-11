---
cursor:
  subagentId: "bc-0ab719b5-2646-52f8-8a6c-6069013cc077"
---

# Starforge design — system overview

**Status:** 3 Nov 2026 snapshot (`main` @ `812b8f5`). **Do not read this first.** The live map is [architecture-current](./architecture-current.md). Routes, port status, and the build queue below are historical where they disagree with that page. Deep dives that are still useful: [design-security](./design-security.md), [design-data-deploy](./design-data-deploy.md), [design-module-boundary](./design-module-boundary.md). Evidence: [architecture-opus-audit](./architecture-opus-audit.md).

Starforge is a reusable, Joomla-like product core for ordinary web projects. ASN 2.0 comes later as a **Hero** on top ([project-context](./project-context.md)).

## 1. Three layers

| Layer | Owns | Code home (target) | Rule |
| --- | --- | --- | --- |
| **Core** | Boot skeleton: auth/session, users/groups/ACL, layout + nav + chrome **host**, Module Manager, env overlay, **ports** | `src/core/*` | Never imports a module's internals. Only `@/generated/module-registry`. |
| **Modules** | Reusable, toggleable product packs: Forms, Media library, Redirects/Sitemap, Consent, Search, Events, Maps, Chat… | `src/modules/<id>/` with a `manifest.ts` | Use ports; never own vendor SDKs. One engine per concern. |
| **Hero** | Site brand theme + unique business rules/workflows (ASN: dark tactical theme, teams/RP, fees) | `src/hero/<site>/` (decide at SF-8) | Skins and extends Modules; never forks them; never bypasses an unfinished Core port. |

Quick test: reusable without saying "airsoft" → Module. Vendor SDK or secret → Core port. Theme, fee table, or approval flow → Hero. Full placement table: [platform-module-layers](./platform-module-layers.md).

**Reality gap (2026-11-11):** Media UI, Consent, Events, Maps, Profiles, Payments, Redirects, Forms, and the TipTap engine live under `src/modules`. The editor receives `MediaPicker` from the caller (`@/modules/media/api`). See [architecture-current](./architecture-current.md). Manifest contract: [design-module-boundary](./design-module-boundary.md).

## 2. Stack (locked defaults)

| Concern | Choice | Notes |
| --- | --- | --- |
| App / routing | **Next.js 16** App Router, React 19 | Public site under `/[locale]`, Core admin `/admin`, Payload under `/cms`. The old `/app/admin` + Payload `/admin` split is gone (SF-213). |
| Content + media store | **Payload 3.92** (Postgres schema `payload`) | Pages (TipTap HTML by default; Lexical remains an optional editor pack). Media (sharp). A content module, not the product core |
| Auth | **Better Auth 1.7** (`public.sf_*`) | Sole login; 2FA/magic link/OTP; Payload bridged via `cms_access` → `payload-token` (no second password) |
| Core data | **Postgres 16 + Drizzle** (`public.sf_*`) | Layouts, chrome, nav, forms, redirects, groups/ACL |
| Cache / later queues | **ioredis** behind ports | Next tag cache locally; Redis on DO |
| Object storage | **@payloadcms/storage-s3** | Local disk → DO Spaces by env |
| Mail | nodemailer / Resend behind `Mailer` | Console in dev |
| Builders | dnd-kit, Zod, CodeMirror | Layout + Form builders share Gantry chrome |
| Styling | Tailwind 4 (theme + utilities, no preflight) + token CSS | shadcn/Radix later for polish |

Admin split: **Core `/admin`** owns Chrome, Settings, Navigation, Users/Groups/ACL, Layouts, and module admin (Forms, Media, Events, Payments, …). **Payload `/cms/admin`** owns editorial collections. One synced left sidebar (`buildAdminNavGroups`).

## 3. Ports (Core)

One active adapter per port, selected by env/factory. Site-wide secrets stay in env. Per-merchant payment keys are the encrypted-table exception in [architecture-current](./architecture-current.md).

| Port | Interface | Adapters | Selector | Status |
| --- | --- | --- | --- | --- |
| Session / auth | Better Auth instance | — (platform) | — | Shipped |
| `Mailer` | `send()` / `info()` | console, SMTP, Resend | Site Chrome provider + env secrets | Shipped |
| `PublishedContentCache` | `getCached` / `invalidateTags` | Next tags, Redis | `STARFORGE_CONTENT_CACHE` | Shipped; fixes in data-deploy §4 |
| Redis client | `getRedisClient()` | ioredis | `REDIS_URL` | Shipped |
| `MediaStorage` | Payload storage plugin selection + `info()` | local, S3/Spaces | `STARFORGE_MEDIA_STORAGE` + `S3_*` | Shipped; private files in design-security §3 |
| Security headers / cookies | `buildSecurityHeaders`, `shouldUseSecureCookies` | — | URL / `STARFORGE_SECURE_COOKIES` | Shipped; CSP target in design-security §4 |
| `RateLimiter` | `consume(key, limit, window)` | memory, Redis | auto when Redis on | **Shipped** (SF-182) |
| `Captcha` | `resolve()` / `verify()` | Turnstile | Settings → Security | **Shipped** in `src/core/security` (SF-184) |
| `MapProvider` | geocode + tiles | leaflet-osm | factory | **Shipped** `src/core/maps` — `product:maps` consumes it |
| `Payments` | gateway / fiscal / billing | Barion, Stripe, PayPal, manual, NAV, Billingo, Számlázz | factory + env or merchant ciphertext | **Shipped** `src/core/payments`. Cart/orders are `product:payments`, not this port. |
| Admin theme | registry `{ tokens, css }` | `starforge-gantry` | `STARFORGE_ADMIN_THEME` | Shipped (CSS import still static) |
| Skin | YAML pack `{ tokens, css, outlines }` | `starforge-pastel` | `STARFORGE_SKIN` / admin **Skins** | **Shipped (v1.3)** — Core port `src/core/skin` + upload/download packs; SF-33 dark skin later |
| `LlmProvider`, `MediaAnalysisPort` | see plans | — | — | **Paper only** until a consumer module ships |
| `RealtimePort` | `publish` / `subscribe` / `info()` | memory bus + SSE `/api/realtime`; Redis fanout later | memory (default) | **Shipped (foundation)** — first product consumers: Notifications, then Chat; RTC (calls) is a separate future port |

Rule: no stub code for ports without a consumer. Earlier stubs (a Redis cache that threw, S3 `info()`) were footguns. RealtimePort ships with SSE + unit proof ahead of Notifications/Chat so those modules do not each invent transport.

## 4. Module Manager direction

1. **Install allowlist (shipped):** `starforge.modules.json` / `SF_MODULES` → `npm run modules:generate` → `src/generated/module-registry.ts` with dynamic `import()` per optional pack.
2. **Runtime toggles (shipped):** Settings → Modules for installed ids; disabled packs don't render, aren't in the palette, and are hidden from nav.
3. **Manifest contract (shipped through M2, media UI at M5):** packs declare particles, admin nav, settings, and lazy imports in `manifest.ts`. Forms, redirects, and TipTap engines live in `src/modules` ([architecture-current](./architecture-current.md)). Contract: [design-module-boundary](./design-module-boundary.md).
4. **Packages (P2):** `@starforge/module-*` from GitHub Packages via deploy-time `modules:sync`; lean and ASN image flavors ([module-toggle-architecture](./module-toggle-architecture.md)).

## 5. Build order and current queue

The table that used to live here (Consent as an open PR, RateLimiter still next, Events not started) is superseded. Live queue: [architecture-current](./architecture-current.md). Locked order is still **Core → Modules → Hero**. Core is the active pass: finish and polish it before the next pack.

## 6. Non-negotiables (from preferences)

- One login (Better Auth). Payload never asks for a password.
- One Form engine, one Media library, one Layout host. Features filter, tag, or ACL the same data.
- Everything optional is allowlisted and toggleable. No deadweight.
- Site-wide secrets only in env / the gitignored overlay. Per-merchant payment keys are the encrypted-table exception ([architecture-current](./architecture-current.md)).
- ACL = groups only (OR match; empty = public). Role stays a thin admin/member gate.
- Postgres never public (localhost / private VPC).
- Admin UX: Gantry dark chrome, full width. Canvas builders autosave on change (not on focus). Entity cards keep bottom-right Save.

## Doc map

| Topic | Doc |
| --- | --- |
| **Live map (read first)** | [architecture-current](./architecture-current.md) |
| Layers decision | [platform-module-layers](./platform-module-layers.md) |
| Inventory by area | [core-modules-inventory](./core-modules-inventory.md) |
| Security target | [design-security](./design-security.md) |
| Data, migrations, CI, env | [design-data-deploy](./design-data-deploy.md) |
| Module contract | [design-module-boundary](./design-module-boundary.md) |
| Ports vs modules philosophy | [replaceable-modularity-plan](./replaceable-modularity-plan.md), [module-toggle-architecture](./module-toggle-architecture.md) |
| Feature plans | [form-engine-plan](./form-engine-plan.md), [media-pipeline-plan](./media-pipeline-plan.md), [events-manager-plan](./events-manager-plan.md), [maps-location-plan](./maps-location-plan.md) |
