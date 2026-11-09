# Starforge core — modular inventory

Durable map of **feature modules** (Site Settings / allowlist toggleable) vs **infrastructure ports** (env/factory swap). Aligns with [modular-core](../principles/modular-core.md), [replaceable-modularity-plan](./replaceable-modularity-plan.md), and [module-toggle-architecture](./module-toggle-architecture.md).

**Lens:** prefer packages already in stack (Better Auth, Payload 3, Next 16, nodemailer, dnd-kit, Zod, sharp). Invent only when the stack has no first-party path.  
**As of:** `origin/main` @ `8d4fada` (includes SF-17 / [#64](https://github.com/seraxes/starforge/pull/64)).

## How to read this

| Field | Meaning |
| --- | --- |
| **Kind** | `module` = product capability; `port` = thin adapter under Core; `platform` = locked default (not a toy swap) |
| **Status** | `shipped` / `partial` / `none` |
| **Recommended** | Best + fastest + easiest path on current stack |
| **Next slice** | Smallest useful increment |

**Toggle layers (both):** runtime `modules.{id}.enabled` in Site Settings + install allowlist `starforge.modules.json` / `SF_MODULES` → generated registry.

---

## Platform spine (not optional toys)

| Area | Kind | Status | Notes |
| --- | --- | --- | --- |
| Better Auth session | platform | shipped | Sole product login; Payload bridged via CMS access — no second password |
| Payload CMS | platform module (`platform:payload-cms`) | shipped | Pages body + Lexical + Media store; Core owns chrome/users/layout |
| Module Manager | module tooling | shipped | Runtime toggles + allowlist codegen (`modules:generate`); P2 GitHub Packages sync still open |

---

## Inventory by area

### Auth (incl. 2FA / passwordless)

| | |
| --- | --- |
| **Kind** | platform (`platform:better-auth`) |
| **Status** | **shipped** |
| **In tree** | Email/password, admin roles, CMS bridge; SF-17: forgot password/username, magic link, email OTP, remember-me, TOTP 2FA + recovery (`better-auth` plugins `magicLink` / `emailOTP` / `twoFactor` + Mailer). Routes: `/forgot-password`, `/reset-password`, `/forgot-username`, `/two-factor`, `/account/security`. |
| **Recommended** | Stay on Better Auth first-party plugins + existing Mailer. Do **not** add Auth.js / Clerk / custom OTP stacks. |
| **Next slice** | Login UX polish / welcome showcase (SF-110). Optional: email verification toggle later. Prod Secure cookies shipped with SF-129. |

### Forms

| | |
| --- | --- |
| **Kind** | module (`product:forms` + particle `form`) |
| **Status** | **partial** (engine shipped; presets beyond contact = stubs) |
| **In tree** | Visual builder (dnd-kit, Layout-like chrome), JSON Schema/Zod, conditional + math, submissions, email notify, Turnstile hook, contact + blank presets. |
| **Recommended** | One Core Form engine; typed presets only. Prefer dnd-kit + Zod (already in). Never SurveyJS / parallel field UIs. |
| **Next slice** | First non-contact preset that a real product needs (survey or ticket) as thin preset JSON — no new builder. Wire option media pickers fully via Media (mostly done SF-66). |

### Layout / Nav / Chrome

| | |
| --- | --- |
| **Kind** | modules (`product:layout-manager`, `product:page-settings`, `product:primary-nav`) + Site Chrome admin surface |
| **Status** | **shipped** (Skin dark variant SF-33 later) |
| **In tree** | Gantry-like outlines/sections/rows/particles, Styles + breakpoints, Page Settings, Nav manager (multi-menu, ACL tags), Site Chrome (offline, captcha policy, meta, robots, cookies), page-surround. Particles: Logo, Menu, Copyright, Social, Custom, page-content, notice-bar, … |
| **Recommended** | Keep layout in Core (not Payload-only). Nav features grow Joomla-like on the same Nav manager. Site Chrome = sitewide policy only. Public brand = **Skin port** (not Layout Styles). |
| **Next slice** | Particle Defaults panel if still thin; SF-33 dark pastel Skin row in admin Skins. |

### Email / Mailer

| | |
| --- | --- |
| **Kind** | port (`Mailer`) + Chrome policy |
| **Status** | **shipped** |
| **In tree** | Adapters: console / SMTP (nodemailer) / Resend; Site Chrome enable/provider/From; Forms notify + auth recovery mail. Secrets in env / Environment editor. |
| **Recommended** | Keep thin `send()` port. Add providers only as adapters. No HTML email designer / queue until volume demands it. |
| **Next slice** | Shared transactional templates (reset / magic / form) as simple React or string helpers on Mailer — still sync send. |

### Env editor

| | |
| --- | --- |
| **Kind** | Core admin tool (not a Site Settings module; gated ops surface) |
| **Status** | **shipped** |
| **In tree** | Site Chrome → Environment; developer-admin + password re-auth; writes gitignored `.env.local` allowlist; prod read-only unless `STARFORGE_ENV_EDITOR=write`. |
| **Recommended** | Keep filesystem overlay only — never DB secrets. Prefer this over inventing a secrets vault UI. |
| **Next slice** | Optional “Clear secret” + restart hint polish; expand allowlist only when a new port needs keys. |

### Admin theme / nav

| | |
| --- | --- |
| **Kind** | port (`admin-theme`) + shared `admin-nav` helper |
| **Status** | **shipped** (one theme; Tailwind/shadcn polish deferred) |
| **In tree** | `starforge-gantry` dark theme; Core + Payload synced left sidebar; CMS accordion = Payload entities only; Site Settings top-level. |
| **Recommended** | Swap look via theme registry CSS entrypoints. Nav structure stays one `buildAdminNavGroups()` — themes must not fork IA. UI kit (Tailwind + shadcn) later for polish, not a second chrome system. |
| **Next slice** | Theme picker / `STARFORGE_ADMIN_THEME` docs when a second theme appears; denser admin width revisit after visual check. |

### Skin (public brand + outline packs)

| | |
| --- | --- |
| **Kind** | port (`skin`) — parallel to `admin-theme`, public only |
| **Status** | **shipped (v1.3)** — YAML pack format + admin install/export; `starforge-pastel` Base / Offline; outline inheritance + nav→Page Settings |
| **In tree** | Pack folders (`skin.yaml` + `outlines/*.yaml` + `skin.css`) under `src/core/skin/skins/` (bundled) and `data/skins/` (uploaded); registry loads both; `SkinRootStyles` injects tokens + CSS; seeds → `sf_layouts`; download re-exports live outlines. Model: [skin-outline-model.md](./skin-outline-model.md). |
| **Recommended** | Skin = brand + outline package on disk (YAML + files). Layout Styles stay on Layouts → Styles. Call them Skins, not themes/templates. |
| **Next slice** | SF-33 dark pastel; optional assets/ folder in packs; restore create/duplicate outline UI if needed. (No per-page skin override — outline comes from nav menu items.) |

### Media

| | |
| --- | --- |
| **Kind** | **Module** (library + pipeline/UI) + Core **ports** (`MediaStorage`, later `MediaAnalysisPort`) |
| **Status** | **partial** (local library shipped; Spaces/S3, tags/categories, AI/OCR hooks later) |
| **In tree** | SF-28/66: folders/purpose, resize/WebP (PNG logos kept), `/app/admin/media`, MediaPicker on Logo/Styles/Form options, `MediaStorage` local + S3 stub. |
| **Recommended** | **One** Payload Media library forever. Tags/categories/ACL same files. Storage + analyzers = Core ports; quality-check AI apps = Hero consumers of `MediaAnalysisPort`. sharp now / ffmpeg later. Plan: [media-pipeline-plan](./media-pipeline-plan.md). |
| **Next slice** | Shared tags/categories facets; S3/Spaces when hosting; `MediaAnalysisPort` stub — not a second media DB. |

### Search

| | |
| --- | --- |
| **Kind** | module (future) |
| **Status** | **none** (admin library filter only) |
| **Recommended** | Start with Payload / Postgres full-text or Next route over published pages — avoid Algolia/Meilisearch until content volume needs it. Reuse Payload pages + Media metadata. |
| **Next slice** | Public search particle + `/search` over published page title/slug/meta; Site Settings toggle. |

### Taxonomy / tags

| | |
| --- | --- |
| **Kind** | mixed — ACL tags shipped; content taxonomy none |
| **Status** | **partial** |
| **In tree** | Viewing ACL = multi group tags on Nav / layout slots / Page Settings (OR match). Media `folder` + `purpose`. No general content taxonomy collection. |
| **Recommended** | Keep ACL as groups-only (no Joomla Access Level entity). Content tags: one Payload collection or shared `sf_tags` reused by pages/posts/media filters — not per-feature tag tables. |
| **Next slice** | When Posts module leaves placeholder: Payload tags/categories on posts/pages, filterable in admin + optional public particle. |

### Security (spam / rate-limit / headers / captcha)

| | |
| --- | --- |
| **Kind** | captcha **port** + Form defenses; headers/middleware |
| **Status** | **partial** (headers + Secure cookies shipped SF-129; Redis rate-limit later) |
| **In tree** | Site Chrome captcha policy; Turnstile widget + server verify; Form honeypot + in-memory rate limit; offline 503 gate; cookie domain/path. SF-129: Next `headers()` + middleware CSP/frame/referrer/nosniff/Permissions-Policy; HSTS + Better Auth `useSecureCookies` (+ Payload JWT / env-gate) when HTTPS URL or `STARFORGE_SECURE_COOKIES=1`. |
| **Recommended** | Captcha: keep provider enum + verify interface (Turnstile now). Rate limit: Form buckets now → Redis-backed limiter when Redis lands. Headers: keep practical baseline — no heavy WAF SDK. Prefer Cloudflare Turnstile over inventing captcha. |
| **Next slice** | Optional global API rate-limit adapter behind same Redis as cache; Site Settings toggles only if product needs runtime header policy. |

### Notifications

| | |
| --- | --- |
| **Kind** | module (future); email path uses Mailer; live push via **RealtimePort** |
| **Status** | **none** as product surface (**partial** = Form/auth email only). Core **RealtimePort** (memory + SSE) shipped as foundation. |
| **Recommended** | Transactional email stays on Mailer. In-app bell/center: store in `sf_*`, `publish` to `user:{id}` on create, optional digests via Mailer. Do not add a third-party notification SaaS early. Do not fork SSE inside the module. |
| **Next slice** | Thin `sf_notifications` + bell UI on RealtimePort; then Chat on the same port. |

### RealtimePort

| | |
| --- | --- |
| **Kind** | Core infrastructure port |
| **Status** | **shipped (foundation)** — memory bus + SSE; `user:{self}` + Maps `map:room:…:team:…` ACL; optional Redis fanout (`STARFORGE_REALTIME_FANOUT=redis`) |
| **In tree** | `src/core/realtime/`; client `useRealtimeChannel` / `connectRealtime`; smoke `POST /api/realtime/smoke`; Site Settings → **Performance** |
| **Recommended** | Modules call `getRealtimePort().publish` only. Chat extends channel ACL similarly. RTC (voice/video) = separate port later. |
| **Next slice** | Notifications consumer; harden Redis fanout in production. |

### i18n

| | |
| --- | --- |
| **Kind** | module / platform later |
| **Status** | **none** |
| **Recommended** | When needed: `next-intl` (or Next built-in) for UI strings + Payload localization for content. Site Chrome hreflang defaults. Avoid inventing a custom i18n framework. |
| **Next slice** | Defer until a locale requirement appears; document string ownership (Core admin EN-first vs Payload locales). |

### Redirects / SEO

| | |
| --- | --- |
| **Kind** | module (`product:redirects`) + Core SEO helpers (sitemap) |
| **Status** | **shipped** (SF-130) |
| **In tree** | Site Chrome site name/description/robots meta + robots.txt (`Sitemap:` injected when module on); Page Settings / Payload page SEO fields; offline; metadata helpers. **`product:redirects`**: `sf_redirects` CRUD at `/app/admin/redirects` + middleware lookup via `/api/redirects/lookup`; **`/sitemap.xml`** via `app/(frontend)/sitemap.ts` over published Payload pages (`home` → `/`). Admin + middleware + sitemap share the same Module Manager toggle. |
| **Recommended** | SEO defaults stay Chrome + page fields. Keep redirects on Core table + middleware (not a second Payload collection). |
| **Next slice** | Optional redirect import/CSV; cache lookup if volume grows. |

### Jobs / queues / Redis

| | |
| --- | --- |
| **Kind** | port (Redis) + optional queue module |
| **Status** | **none** (Redis cache stub only) |
| **In tree** | `PublishedContentCache` Redis factory throws until implemented; sessions still Better Auth/DB. |
| **Recommended** | One Redis for cache → sessions/rate-limit → queues. Prefer **BullMQ** + **ioredis** when first background job appears (mail retries, media variants, webhooks). Local stays sync/in-memory. |
| **Next slice** | Implement `createRedisPublishedContentCache` behind existing interface before queues. |

### Webhooks

| | |
| --- | --- |
| **Kind** | module + outbound port later |
| **Status** | **none** |
| **Recommended** | Outbound: signed HTTP POST helper + optional queue. Inbound: Next route handlers per integration (Better Auth/Payload hooks where native). No Zapier-class engine in Core. |
| **Next slice** | Defer until an integration needs it; first consumer likely Forms or CMS publish hooks. |

### Cache

| | |
| --- | --- |
| **Kind** | port (`PublishedContentCache`) |
| **Status** | **partial** |
| **In tree** | Interface + Next/tag default; used by published pages + Site Chrome; Redis adapter stub. |
| **Recommended** | Callers keep using `getPublishedPageBySlug` / helpers — never Redis directly. Select via `STARFORGE_CONTENT_CACHE`. |
| **Next slice** | Real Redis adapter for DO multi-instance; then share client with rate-limit/sessions. |

### Consent (cookies / privacy)

| | |
| --- | --- |
| **Kind** | module (`product:consent`) |
| **Status** | **shipped** (SF-131) |
| **In tree** | Toggleable banner on public layout; prefs in first-party `sf-consent` cookie (no DB table). Site Chrome: banner message + privacy URL/label (reuses cookie domain/path). `atom:analytics` loads gtag only after analytics accepted when Consent is on. |
| **Recommended** | Stay lightweight — Chrome policy + preference cookie before a full CMP vendor. |
| **Next slice** | Optional category UI (manage prefs) / per-category particles; keep cookie-only unless an audit trail is required. |

### Events / venues

| | |
| --- | --- |
| **Kind** | **Module** (`product:events`); optional Core **`LlmProvider`** port for description draft |
| **Status** | **none** (plan only) |
| **Recommended** | Generic venue/event + Form registration preset + calendar particles. AI assist = Mailer-like LLM port; prompt from fields; editor inserts draft. ASN field/milsim = **Hero**. Plan: [events-manager-plan](./events-manager-plan.md). |
| **Next slice** | Defer until Media taxonomy + Forms presets solid; first slice = venue/event CRUD + list particle (no AI yet). |

### Maps / location

| | |
| --- | --- |
| **Kind** | **Module** (`product:maps`) + Core **`MapProvider`** port |
| **Status** | **partial / shipping** — MapProvider + venue pins + map particle; **live tactical rooms** (closed roster) in Maps module. Generic social location shares still plan-only. |
| **Recommended** | **TacMap** (short) / **Tactical Maps** (long) — [maps-live-tactical](./maps-live-tactical.md). Stations / hold / beacons roadmap; ASN beacon SKUs = **Hero**. Shares everyone/friends/selected = [maps-location-plan](./maps-location-plan.md) later. |
| **Next slice** | Capacitor background GPS; stations + GPS hold-to-capture; then BLE beacon presence; ASN shop kits. |

---

## Hero (ASN and others) — not “never Modules”

**Clarified 2026-11-03:** marketplace, shop, stream, chat, social, ads, events/venues, maps are **future optional Modules**. ASN (and peers) own **Hero**: visual theme + unique business logic — not parallel modules. Placement table: [platform-module-layers](./platform-module-layers.md).

| Hero leftover | Stays out of generic Modules |
| --- | --- |
| ASN theme (public/admin brand skins) | Design only — uses Layout + admin-theme |
| ASN marketplace fees / airsoft catalog rules | Vertical commerce policy on Marketplace/Shop |
| ASN stream branding / paywall rules | Vertical on Stream Module |
| ASN squad defaults / milsim channels | Vertical on Chat/Social |
| ASN-specific ACL policies | Beyond Core groups matrix |
| Team mgmt, RP characters, airsoft-only ops | Pure Hero |
| Event/field semantics beyond generic venue/booking | ASN nouns on Events Module |
| Quality-check AI apps | Hero/external apps → `MediaAnalysisPort` |

**Now:** do not implement heavy Module packs until Core ports land. Reuse Form presets, Media, Nav module views, Mailer, Auth.

---

## Priority cheat-sheet (platform gaps)

Order favors “finish Core ports before Hero pressure invents shortcuts”:

1. **Cache Redis adapter** — unlocks DO + shared limiter later.  
2. **Media S3/Spaces** — when hosting prep starts.  
3. ~~**Security headers + Secure cookies**~~ — SF-129 shipped.  
4. ~~**sitemap + redirects**~~ — SF-130 shipped.  
5. ~~**Consent**~~ — SF-131 shipped (`product:consent` + analytics gate).  
6. **Search / content taxonomy** — when Posts or public findability needs them.  
7. **Queues / webhooks / i18n / in-app notifications** — on demand.

Hold ASN Hero (SF-8) until media storage + Redis cache are real adapters, not stubs.

---

## Related docs

- [replaceable-modularity-plan](./replaceable-modularity-plan.md)  
- [module-toggle-architecture](./module-toggle-architecture.md)  
- [auth-recovery-2fa-plan](./auth-recovery-2fa-plan.md)  
- [form-engine-plan](./form-engine-plan.md)  
- [email-mailer-plan](./email-mailer-plan.md)  
- [admin-env-editor-plan](./admin-env-editor-plan.md)  
- [media-pipeline-plan](./media-pipeline-plan.md)  
- [events-manager-plan](./events-manager-plan.md)  
- [maps-location-plan](./maps-location-plan.md)  
- [payload-admin-theme-plan](./payload-admin-theme-plan.md)  
- [starforge-track-audit](./starforge-track-audit.md)  
- [platform-module-layers](./platform-module-layers.md)  

