---
cursor:
  subagentId: "bc-0ab719b5-2646-52f8-8a6c-6069013cc077"
---

# Starforge design — system overview

**Status:** target design as of `main` @ `812b8f5` (Nov 3, 2026). Read this first; the deep-dive docs are [design-security](./design-security.md), [design-data-deploy](./design-data-deploy.md), and [design-module-boundary](./design-module-boundary.md). The evidence behind them is in [architecture-opus-audit](./architecture-opus-audit.md).

Starforge is a reusable, Joomla-like product core for ordinary web projects. ASN 2.0 comes later as a **Hero** on top ([project-context](./project-context.md)).

## 1. Three layers

| Layer | Owns | Code home (target) | Rule |
| --- | --- | --- | --- |
| **Core** | Boot skeleton: auth/session, users/groups/ACL, layout + nav + chrome **host**, Module Manager, env overlay, **ports** | `src/core/*` | Never imports a module's internals. Only `@/generated/module-registry`. |
| **Modules** | Reusable, toggleable product packs: Forms, Media library, Redirects/Sitemap, Consent, Search, Events, Maps, Chat… | `src/modules/<id>/` with a `manifest.ts` | Use ports; never own vendor SDKs. One engine per concern. |
| **Hero** | Site brand theme + unique business rules/workflows (ASN: dark tactical theme, teams/RP, fees) | `src/hero/<site>/` (decide at SF-8) | Skins and extends Modules; never forks them; never bypasses an unfinished Core port. |

Quick test: reusable without saying "airsoft" → Module. Vendor SDK or secret → Core port. Theme, fee table, or approval flow → Hero. Full placement table: [platform-module-layers](./platform-module-layers.md).

**Reality gap (to close):** Forms, Media, Redirects, and Consent logic currently lives in `src/core/*`, and every new pack edits Core (admin nav, two catalogs, schema, middleware). The fix is the manifest contract in [design-module-boundary](./design-module-boundary.md).

## 2. Stack (locked defaults)

| Concern | Choice | Notes |
| --- | --- | --- |
| App / routing | **Next.js 16** App Router, React 19 | Public site, Core admin `/app/admin`, Payload mount `/admin`, APIs |
| Content + media store | **Payload 3.92** (Postgres schema `payload`) | Pages (Lexical, drafts), Media (sharp), `site-settings` global. A content module, not the product core |
| Auth | **Better Auth 1.7** (`public.sf_*`) | Sole login; 2FA/magic link/OTP; Payload bridged via `cms_access` → `payload-token` (no second password) |
| Core data | **Postgres 16 + Drizzle** (`public.sf_*`) | Layouts, chrome, nav, forms, redirects, groups/ACL |
| Cache / later queues | **ioredis** behind ports | Next tag cache locally; Redis on DO |
| Object storage | **@payloadcms/storage-s3** | Local disk → DO Spaces by env |
| Mail | nodemailer / Resend behind `Mailer` | Console in dev |
| Builders | dnd-kit, Zod, CodeMirror | Layout + Form builders share Gantry chrome |
| Styling | Tailwind 4 (theme + utilities, no preflight) + token CSS | shadcn/Radix later for polish |

Admin split: **Core `/app/admin`** owns Chrome, Settings, Navigation, Users/Groups/ACL, Layouts, Forms, Media UI, and Redirects. **Payload `/admin`** owns editorial collections. One synced left sidebar (`buildAdminNavGroups`).

## 3. Ports (Core)

One active adapter per port, selected by env/factory, with secrets in env only ([preferences](../preferences.md)).

| Port | Interface | Adapters | Selector | Status |
| --- | --- | --- | --- | --- |
| Session / auth | Better Auth instance | — (platform) | — | Shipped |
| `Mailer` | `send()` / `info()` | console, SMTP, Resend | Site Chrome provider + env secrets | Shipped |
| `PublishedContentCache` | `getCached` / `invalidateTags` | Next tags, Redis | `STARFORGE_CONTENT_CACHE` | Shipped; fixes in data-deploy §4 |
| Redis client | `getRedisClient()` | ioredis | `REDIS_URL` | Shipped |
| `MediaStorage` | Payload storage plugin selection + `info()` | local, S3/Spaces | `STARFORGE_MEDIA_STORAGE` + `S3_*` | Shipped; private files in design-security §3 |
| Security headers / cookies | `buildSecurityHeaders`, `shouldUseSecureCookies` | — | URL / `STARFORGE_SECURE_COOKIES` | Shipped; CSP target in design-security §4 |
| `RateLimiter` | `consume(key, limit, window)` | memory, Redis | auto when Redis on | **Planned (now)**: design-security §6 |
| `Captcha` | `resolve()` / `verify()` | Turnstile | Settings → Security | Partial (lives in `core/forms`; move to `core/security`) |
| Admin theme | registry `{ tokens, css }` | `starforge-gantry` | `STARFORGE_ADMIN_THEME` | Shipped (CSS import still static) |
| Skin | registry `{ tokens, css }` + outline seeds | `starforge-pastel` | `STARFORGE_SKIN` / admin **Skins** | **Shipped (v1)** — Core port `src/core/skin`; **open:** installable skin packages (Install + copy/export to other sites); SF-33 dark skin later |
| `LlmProvider`, `MapProvider`, `MediaAnalysisPort` | see plans | — | — | **Paper only** until a consumer module ships |
| `RealtimePort` | `publish` / `subscribe` / `info()` | memory bus + SSE `/api/realtime`; Redis fanout later | memory (default) | **Shipped (foundation)** — first product consumers: Notifications, then Chat; RTC (calls) is a separate future port |

Rule: no stub code for ports without a consumer. Earlier stubs (a Redis cache that threw, S3 `info()`) were footguns. RealtimePort ships with SSE + unit proof ahead of Notifications/Chat so those modules do not each invent transport.

## 4. Module Manager direction

1. **Install allowlist (shipped):** `starforge.modules.json` / `SF_MODULES` → `npm run modules:generate` → `src/generated/module-registry.ts` with dynamic `import()` per optional pack.
2. **Runtime toggles (shipped):** Settings → Modules for installed ids; disabled packs don't render, aren't in the palette, and are hidden from nav.
3. **Manifest contract (next):** every pack declares particles, admin nav, settings, DB schema, proxy hooks, public-shell slots, CSP sources, and env keys in `manifest.ts`. Codegen builds **one** catalog plus route shims ([design-module-boundary](./design-module-boundary.md)).
4. **Packages (P2):** `@starforge/module-*` from GitHub Packages via deploy-time `modules:sync`; lean and ASN image flavors ([module-toggle-architecture](./module-toggle-architecture.md)).

## 5. Build order and current queue

Locked order: **Core → Modules → Hero**. Core is agile: thin, solid ports, iterated.

| Step | State |
| --- | --- |
| Form must-haves (#75), Redis cache (#76), Spaces (#77), headers/cookies (#78), sitemap/redirects (#79) | Merged |
| Consent (SF-131, [#81](https://github.com/seraxes/starforge/pull/81)) | Open PR |
| **Core hardening** (design-security "Now" list) + **deploy-ready** (migrations, CI, env validation) | **Recommended next**, before search/taxonomy |
| Module manifest M0–M2 | Alongside hardening; small, mostly codegen |
| Search/taxonomy (SF-132), Form Should (SF-133) | After hardening; SF-133 needs the submission data changes first |
| Heavy Modules (Events, Maps, Chat, Shop…) | Only on the manifest contract and real ports |
| Hero / ASN (SF-8) | After Skin port (shipped) + dark skin (SF-33) + the manifest extension seam |

Focus guard: stay on this queue; no Hero/ASN or heavy packs until the Core ports for that step are real ([preferences](../preferences.md)).

## 6. Non-negotiables (from preferences)

- One login (Better Auth). Payload never asks for a password.
- One Form engine, one Media library, one Layout host. Features filter, tag, or ACL the same data.
- Everything optional is allowlisted and toggleable. No deadweight.
- Secrets only in env / the gitignored overlay; never in the DB.
- ACL = groups only (OR match; empty = public). Role stays a thin admin/member gate.
- Postgres never public (localhost / private VPC).
- Admin UX: Gantry dark chrome, autosave on change (not on focus), full width.

## Doc map

| Topic | Doc |
| --- | --- |
| Layers decision | [platform-module-layers](./platform-module-layers.md) |
| Inventory by area | [core-modules-inventory](./core-modules-inventory.md) |
| Security target | [design-security](./design-security.md) |
| Data, migrations, CI, env | [design-data-deploy](./design-data-deploy.md) |
| Module contract | [design-module-boundary](./design-module-boundary.md) |
| Ports vs modules philosophy | [replaceable-modularity-plan](./replaceable-modularity-plan.md), [module-toggle-architecture](./module-toggle-architecture.md) |
| Feature plans | [form-engine-plan](./form-engine-plan.md), [media-pipeline-plan](./media-pipeline-plan.md), [events-manager-plan](./events-manager-plan.md), [maps-location-plan](./maps-location-plan.md) |
