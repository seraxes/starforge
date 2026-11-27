---
kind: live
last_verified: 2026-11-27
---
# Starforge architecture — current

Last verified against code: 2026-11-27 (Social polish Active; Marketplace slice 4 public loop in tree, saves next; Onboarding slice 2 statuses and identity facts in tree, default off; Chat and Shop after Marketplace; live video stays in Social).

**This page wins** when it disagrees with an older plan, preference bullet, or status table. Plans and audits are history.

## What this platform is

Reusable starter: auth, layout host, content manager behind PageReadsPort, toggleable packs. ASN 2.0 / Airsoft Nexus is a later Hero on those packs; InspecTra may ship earlier.
**Core** — host + ports. **Base** — a product pack that depends only on Core. In tree: Media. **Advanced** — a product pack that `requires` another module: Forms, Rich editor, Email Manager, Payments, Profiles, Maps (in progress), Events, Subscriptions, Social (live video stays here — no `product:stream`), Marketplace (slice 4 public loop in tree, saves next), Onboarding (PrimeOne, slice 2 in tree, default-off; Fleet and Documents stay parked), Chat and Shop (after Marketplace), Ads (catalog + admin / default-off; parked until after Marketplace — plan: [ads-pack-plan](./ads-pack-plan.md)). Support stays later. **Hero** — brand + vertical rules, not a module.
`product:pages` is the content manager (site pack), not a base engine. Base modules are not Core. Class test: [2026-11-26-base-vs-advanced](./decisions/2026-11-26-base-vs-advanced.md).
Placement: [platform-module-layers](./platform-module-layers.md). Rules: [sf-architecture](../../../.cursor/rules/sf-architecture.mdc), [sf-module-ownership](../../../.cursor/rules/sf-module-ownership.mdc).

## Launch scope

Accepted: [2026-11-22-launch-scope](./decisions/2026-11-22-launch-scope.md).

- **First production site:** Airsoft Nexus — every module already built; Lexical may stay off.
- **Earlier site allowed:** InspecTra (quality inspection) may ship before Airsoft Nexus; Core polish comes first.
- **Do not archive built modules.** Nothing built stays off except the possible Lexical exception.
- **Absent until built:** Chat and Shop, after Marketplace (and any other pack not in the tree). There is no `product:stream`; live video is part of Social ([2026-11-26-chat-shop-stream](./decisions/2026-11-26-chat-shop-stream.md)). Ads is in tree (`src/modules/ads`, default-off) with catalog schema + `/admin/ads`; Payments bridge / Social publish parked until after Marketplace (and other major advanced modules). Marketplace slice 4 is the public loop (`/marketplace` browse / create / you / detail / edit) on top of listings, settings, categories, and the fail-closed door. Saves are slice 5. Onboarding slice 2 is statuses and identity facts (`defaultEnabled: false`). Procedure is slice 3.
- **Migrate:** users, avatars, profile settings (new password on first login — do not migrate passwords); upcoming events only (past events stay archived on the old site); marketplace user ratings. Marketplace posts = later examination, not a cutover requirement. Everything else stays on the old site.

## Build queue

Core → base → advanced → Hero still holds. Core finish (slices 1–9) and the base-module pass items that were open on this map (requires-graph auto-enable, Payments `requestOrderRefund`, Forms CSV / stringConstraints / success redirect, Mailer transactional helper, admin theme CSS from the registry) are in tree. Paid event tickets and the Subscriptions lifecycle are in tree. `sf_pay_collect_entitlements` stays a frozen stub; collect reads `payments.collect` when Subscriptions is on. Social enablement blockers (media attach/serve, staff private-read, write rate limits) are **Done** — see Open work rows below.

| Lane | What |
| --- | --- |
| **Active** | Social polish and complete (enablement blockers Done). Close remaining Social Open work / UX leftovers before turning Social on for cutover. Brief: [social-module-standing](./social-module-standing.md). Core / launch polish in parallel where it blocks cutover. |
| **In progress** | TacMap (`product:maps`). Venue pins and live rooms are in tree. Stations, BLE beacons, and `apps/asn-capacitor` stay parked. This does not jump ahead of Social polish or Marketplace. |
| **Next after Social** | Marketplace. Slice 4 (public loop) is in tree. Next is slice 5 (saves) — [marketplace-build-spec](./marketplace-build-spec.md). Do not start Ads, Chat, or Shop ahead of Marketplace unless the live map moves. |
| **PrimeOne** | Onboarding (`product:onboarding`). Slice 2 (status builder + identity facts) is in tree. `defaultEnabled: false`. Procedure / notes / invite is slice 3 — [onboarding-build-spec](./onboarding-build-spec.md). Fleet and Documents stay parked. |
| **After Marketplace** | Chat and Shop. Live video is not a pack in this lane; it belongs to Social. |
| **Parked** | Ads (slice 2 catalog + admin in tree / default-off; resume after Marketplace and other major advanced modules — [ads-pack-plan](./ads-pack-plan.md)), Notifications, ASN Hero theme / currency / `apps/asn-capacitor`, TacMap stations / BLE beacons, durable `product:campaigns`, organizations, support, outbound webhooks. Fleet + Documents (plans and build specs written — [primeone-pack-plans](./primeone-pack-plans.md); coverage [primeone-coverage-plan](./primeone-coverage-plan.md); do not scaffold). Ledger and warehouse later ([ledger-pack-plan](./ledger-pack-plan.md), [warehouse-pack-plan](./warehouse-pack-plan.md)). |

The 5 Nov wireframe order does not override this. Event slot kinds decided as choosable Ticket type / Booking type / Faction (+ admin names) wait; code is still `general \| faction` on `sf_event_ticket_tiers.kind`.

## Social (Active — polish and complete)

**`product:social`** — slices **1–22** documented in `src/modules/social/manifest.ts` and the pack README; `defaultEnabled: false` until site cutover turns it on. Enablement blockers that were open on this map are **Done** (media attach/serve audience checks, staff private-read, member write rate limits). Remaining Active work is polish / complete (Open work leftovers + UX) before cutover turns Social on. Brief: [social-module-standing](./social-module-standing.md). Hard `requires`: profiles, media, rich-editor, forms, email-manager. `optionalRequires`: `form` (particle pack `src/modules/form`), `product:subscriptions`, `product:events`. Not Payments / not Maps ([2026-11-22-social-dependency-floor](./decisions/2026-11-22-social-dependency-floor.md)). Posture: [2026-11-22-social-built-parked](./decisions/2026-11-22-social-built-parked.md). Comments, likes, and reports stay in Social — no `product:comments` / `product:reports` ([2026-11-22-comments-reports-ownership](./decisions/2026-11-22-comments-reports-ownership.md)). Ads stays parked (slice 2 in tree); do not resume Ads slices ahead of Marketplace. Live video stays in Social; do not add `product:stream` ([2026-11-26-chat-shop-stream](./decisions/2026-11-26-chat-shop-stream.md)). Chat and Shop start after Marketplace.

## Open work

| Item | Owner | Status | Blocking launch? | Link |
| --- | --- | --- | --- | --- |
| Media access — attach: refuse bind when the target audience is wider than the file’s level | Social (+ Media) | Done (Social enablement closed) | only if Social is on | [2026-11-22-media-access-model](./decisions/2026-11-22-media-access-model.md), `src/modules/social/posts.ts` |
| Media access — serve: `/api/media/[id]` must honor the owning audience | Media (+ Social) | Done (Social enablement closed) | only if Social is on | [2026-11-22-media-access-model](./decisions/2026-11-22-media-access-model.md), `src/modules/social/media-serve-store.ts`, `src/app/api/media/` |
| Staff / moderator private-read on front end (`only_me`, friends-only) | Core ACL / Social | Done (Social enablement closed) | only if Social is on | [2026-11-22-staff-bypass-limits](./decisions/2026-11-22-staff-bypass-limits.md), `src/modules/social/posts.ts` `canViewPost` |
| Rate limits on Social member writes | Social + Core RateLimiter | Done (Social enablement closed) | only if Social is on | `src/modules/social/rate-limit.ts`, `src/core/security/rate-limit` |
| Seed refuses production; README must not treat the seed password as production | Core seed / README | Done; `assertSeedAllowed` refuses `NODE_ENV=production` unless `STARFORGE_ALLOW_PRODUCTION_SEED=1`. README warns local-only | yes | `src/seed-production-guard.ts`, `src/seed.ts`, `README.md` |
| Env validation rejects placeholder secrets | Core env | Done; production errors on `.env.example` values and secrets containing `dev-only` / `change-me`; CI `ci-only-*` secrets are not placeholders; dev/test warn only | yes | `src/core/env/validate.ts` |
| Dedicated payment-credentials key required in production | Payments | Done; production requires non-placeholder `SF_PAY_CREDENTIALS_KEY` (no `PAYLOAD_SECRET` / hardcoded fallback); dev may still fall back | yes | `src/modules/payments/credentials-crypto.ts`, `src/core/env/validate.ts` |
| Production warning when `STARFORGE_TRUSTED_PROXY_HOPS` is unset | Core env | Done; production warns (not errors) when unset/empty; non-integer stays a warning; CI boots without the key | yes | `src/core/env/validate.ts` |
| Social `optionalRequires` contains particle id `form` | Social | Confirmed: `form` is `src/modules/form` (`kind: 'particle'`). Keep or drop is undecided. Only if Social is on | only if Social is on | `src/modules/social/manifest.ts`, `src/modules/form/manifest.ts` |
| Rename `product:maps` to TacMap (id / docs consistency) | Maps | Open; do not rename in the Social dependency slice. Pack README already brands TacMap. Maps stays in progress | no | [2026-11-22-social-dependency-floor](./decisions/2026-11-22-social-dependency-floor.md), `src/modules/maps/README.md` |
| Manifest `layer` vs base/advanced class test | Core boot | Open. The class test is accepted. Do not retag `layer` until a site pack no longer `requires` a pack that would boot later (`product:pages` requires the rich editor). Boot order stays base, then site, then advanced | no | [2026-11-26-base-vs-advanced](./decisions/2026-11-26-base-vs-advanced.md), `src/core/modules/boot-order.ts` |
| Event / page conversation UI on Social’s comments engine | Social (+ Events / Pages) | Accepted ownership; event conversation not built | no | [2026-11-22-comments-reports-ownership](./decisions/2026-11-22-comments-reports-ownership.md) |
| `dangerouslySetInnerHTML` sites need a sanitization review | Core + packs | Open; custom particle HTML, page-settings inject, Events description, and others | no | e.g. `src/core/modules/particles/custom.tsx` |
| Event slot kinds chooser (Ticket type / Booking type / Faction + admin names) | Events | Decided; code still `general \| faction` | no | `src/modules/events/schema.ts` |
| Organizations, outbound webhooks, support | TBD | Parked; not ahead of Marketplace | no | — |
| Onboarding | DSP | Slice 2 status builder + identity facts in tree (`defaultEnabled: false`). Procedure / notes / invite is slice 3. `optionalRequires` Fleet waits until that manifest exists. Station catalog is Fleet; Onboarding stores the station id. Bookable is a bookable status or vehicle access. Quiz mode belongs in Forms. No Core fact-map port | no | [onboarding-build-spec](./onboarding-build-spec.md), [onboarding-pack-plan](./onboarding-pack-plan.md) |
| Fleet + Documents | DSP | Plans and build specs written; packs not scaffolded. Parked — do not scaffold. | no | [primeone-coverage-plan](./primeone-coverage-plan.md), [fleet-build-spec](./fleet-build-spec.md), [documents-build-spec](./documents-build-spec.md), [primeone-pack-plans](./primeone-pack-plans.md) |
| Durable subscriber-list `product:campaigns` | Email Manager later | Parked. Light paste campaigns live in Email Manager today | no | `sf-email-module.mdc` |
| Checkout coupons | Payments | Shipped under Payments (not a promotions pack) | no | `/admin/payments/coupons` |
| `modules:sync` omits unchosen in-repo engines | Installer | Target only; sync adds/removes `@starforge/module-*` (notice-bar, consent). Other packs stay in this repo | no | [module-install-packages](./module-install-packages.md) |

## Routes

| Surface | Path |
| --- | --- |
| Core admin | `/admin` (root = Dashboard). Pages `/admin/pages`. Media `/admin/media`. |
| Former `/cms` | Redirects to `/admin` (`next.config.ts`). |
| Public site | `/[locale]/…` |

## Secrets

| Kind | Home |
| --- | --- |
| Site-wide (`PAYLOAD_SECRET`, `BETTER_AUTH_SECRET`, platform gateway, SMTP, Turnstile, `REDIS_URL`, API keys) | Process env / gitignored Environment overlay. Never `site_settings`, never a Chrome field. |
| Per-merchant gateway and Billingo / Számlázz keys | Encrypted `sf_pay_merchant_credentials`. Not Site Chrome env. Never plaintext. Never logs. |

The second row is the exception to “secrets never in the database.”

## Editors

`product:rich-editor` (TipTap, `sanitizeRichHtml`) is the default for module fields and the page body. `product:lexical-editor` stays optional (`defaultEnabled: false`); `@payloadcms/richtext-lexical` remains for that pack. Do not delete Lexical once migration is done.

## Installer

Installing Starforge means choosing which modules come with that site ([module-install-packages](./module-install-packages.md)): `modules:wizard` → allowlist, `modules:sync` → `@starforge/module-*` deps, `modules:generate` → registry. Site Settings → Modules only hides an installed pack; it does not remove code. Hard `requires` auto-enable via `src/core/modules/requires-graph.ts`.

**Always present:** auth, users/groups, admin shell, module installer, layout/nav/chrome, Page Settings, Skin, i18n host, Mailer and cache interfaces.

**Not a separate download today unless packaged:** most engines still live in this monorepo (see Open work). Notice-bar and consent are real `@starforge/module-*` packages.

**Content manager:** `product:pages` in `src/modules/pages` (`requires` rich-editor + media). Owns editorial pages, last 20 versions (`PAGE_VERSION_KEEP`), page admin, categories, tags. Status draft / published / unpublished. Public reads go through `PageReadsPort`; pack off → empty reads. Nav page binds call the pack door (Core does not import the pack). `product:media` owns `sf_media_*`; blobs on MediaStorage. Site settings (`moduleToggles`, performance, `primaryNavMenuId`, `rootItem`) live on Core `sf_site_settings`. `rootItem` is the one nav item for `/{locale}` in every locale. CMS access is Better Auth + `sf_users.cms_access`. No second CMS; peel: [2026-11-15-payload-peel](./decisions/2026-11-15-payload-peel.md).

**Payload peel (done):** phases 1–4 shipped 2026-11-16. Decision: [2026-11-15-payload-peel](./decisions/2026-11-15-payload-peel.md). Archive: [payload-dependency-map](../../archive/payload-dependency-map.md). Queue: Social polish → Marketplace → (later) Ads resume ([ads-pack-plan](./ads-pack-plan.md)).

**Requires chain:** Forms → Media; Rich editor → Media; Email Manager → Rich editor + Media; Payments → Email Manager; Profiles → Media + Forms; Maps → Media. Events requires Forms, Media, Rich editor, Payments, Profiles, Maps. Subscriptions requires Payments, Email Manager, Forms, Profiles. Social requires Profiles, Media, Rich editor, Forms, Email Manager (not Payments, not Maps). Ads requires Social, Email Manager, Forms, Subscriptions, Payments (`optionalRequires`: Media). Marketplace requires Payments, Profiles, Media, and Email Manager (`optionalRequires`: Social, Subscriptions). Public loop is in tree; saves are slice 5. It stays advanced. Onboarding requires Forms, Media, Email Manager, and Profiles. `optionalRequires` Fleet is omitted until `product:fleet` is a manifest id. `defaultEnabled: false`. Slice 2 is statuses and identity facts. It stays advanced.

## Module class

Deciding rule: [2026-11-26-base-vs-advanced](./decisions/2026-11-26-base-vs-advanced.md). A product pack that depends only on Core is **base**. A product pack that `requires` another module is **advanced**. Site packs stay site. Hero is not a module.

Manifest `layer` is the boot tag. It is not retagged in feature slices (open work above).

| Pack | Requires another module | Class | Manifest `layer` |
| --- | --- | --- | --- |
| `product:media` | no | base | `base` |
| `product:forms` | Media | advanced | `base` |
| `product:rich-editor` | Media | advanced | `base` |
| `product:email-manager` | Rich editor, Media | advanced | `base` |
| `product:payments` | Email Manager | advanced | `base` |
| `product:profiles` | Media, Forms | advanced | `base` |
| `product:maps` | Media | advanced (in progress) | `base` |
| `product:events` | Forms, Media, Rich editor, Payments, Profiles, Maps | advanced | `advanced` |
| `product:subscriptions` | Payments, Email Manager, Forms, Profiles | advanced | `advanced` |
| `product:social` | Profiles, Media, Rich editor, Forms, Email Manager | advanced | `advanced` |
| `product:marketplace` | Payments, Profiles, Media, Email Manager (`optionalRequires`: Social, Subscriptions) | advanced (slice 4 public loop; saves next) | `advanced` |
| `product:onboarding` | Forms, Media, Email Manager, Profiles (`optionalRequires` Fleet when that pack exists) | advanced (slice 2 statuses + identity facts; default off; procedure next) | `advanced` |
| `product:ads` | Social, Email Manager, Forms, Subscriptions, Payments | advanced (parked) | `advanced` |

Site packs (not this test): `product:pages` (requires Rich editor and Media), `product:pwa` (requires Media), `product:audit`, `product:consent`, `product:lexical-editor`, `product:notice-bar`, `product:redirects`, `product:search`. The `form` particle requires `product:forms` and stays a particle. The `cookie-settings` particle requires `product:consent` (reopen control; banner stays on `publicShell`).

## Languages

Localization owns `defaultLocale` and `localeFallback`. One layout outline for every language. Particle chrome reads the message catalog for `[locale]`. Editor-typed copy uses Localization’s `LocaleInput` when more than one public locale is on. Content-locale files: `data/content-locales/{locale}/…` + `pickContentLocaleText`. UI chrome packs stay separate. Page title / body / SEO use `pages/{id}.json`.

## Hero vs module

| Belongs in the module | Belongs in Hero |
| --- | --- |
| Maps rooms, teams, roster, same-team GPS | ASN map chrome, beacon SKUs, `apps/asn-capacitor` |
| Event slot kinds (chooser when built) | Milsim sheets, association membership, TEÁOR, field-safety |
| Profiles `extensions` jsonb | ASN team / airsoft fields inside that jsonb |
| Real-money checkout (Payments) | **ASN currency** — Hero token; no ledger on `sf_pay_*` / `sf_events_*` |

## Accepted transitions

Do not relocate these in a drive-by:

| Thing | Where it lives | Rule |
| --- | --- | --- |
| Forms engine | `src/modules/forms` | Consumers import `@/modules/forms/api` only. |
| Redirects engine | `src/modules/redirects` | Core calls the generated hook only. |
| TipTap engine | `src/modules/rich-editor` | Callers use `@/modules/rich-editor/api` (+ `api.server` for sanitize/gate). MediaPicker passed in from media. |
| Forms success mail | `emitEmailTrigger` only | No `getMailer()` from Forms. |
| `sf_pay_collect_entitlements` | Frozen stub | Subscriptions on → `payments.collect`. |
| Payment fulfillment | `registerPaymentConsumerHook` | One hook key per consumer; later listeners isolated. |
| Online payment gateway | `src/core/payments/<id>.ts` + `register-online.ts` | Developer ships; admin enables + pastes keys. |
| Process boot | `runModuleBoot` then `runHeroBoot` | `instrumentation.ts` asserts env, then both. |
| Page reads | `PageReadsPort` | Layout, search, sitemap use `getPageReads()`. |
| Side-by-side layout sections | `rowContainers` on the layout document | Two or more sections on one line get a row container. It owns container mode and basic section settings. Member sections keep width % and ignore container mode. |
| Admin ACL | Core groups: view / edit / manage | No Access Level entity. App admin bypasses. |
| Staff bypass | App admins + pack `admin.<id>` edit/manage on ownership gates; staff UI additive. Front-end private-read (`only_me` / friends / group) uses the same Social staff grant in `canViewPost` | [2026-11-21-staff-bypass](./decisions/2026-11-21-staff-bypass.md), [2026-11-22-staff-bypass-limits](./decisions/2026-11-22-staff-bypass-limits.md), `sf-staff-bypass.mdc` |
| Comments / likes / reports | `product:social` only — no `product:comments` / `product:reports`. Pages/events may opt into Social’s conversation engine when Social is on | [2026-11-22-comments-reports-ownership](./decisions/2026-11-22-comments-reports-ownership.md) |
| Admin audit | Core `sf_admin_audit` + optional `product:audit` reader | No second audit table. |

New packs follow Payments: port in `src/core/<port>`, product behavior in `src/modules/<id>`.

## Ports

Shipped: Mailer, PublishedContentCache, Redis client, MediaStorage, RateLimiter, Captcha (`src/core/security`), admin theme, Skin, RealtimePort, MapProvider (`leaflet-osm`), Payments adapters (gateways, FiscalProvider, BillingProvider), PageReadsPort, JobRunner.

Online gateways: developer adds adapter + `register-online.ts` import ([decision](./decisions/2026-11-15-payment-gateway-registry.md)).

`MediaAnalysisPort` is a noop stub. `LlmProvider` is not in the tree — add only when a consumer needs it.

## Manifest edges

`requires` and `optionalRequires` both count for a legal public-door import. Hard `requires` drives install and enable ([decision](./decisions/2026-11-15-requires-optional.md), [glossary](./glossary.md)).

**Public door:** cross-module calls only through `@/modules/<id>/api` / `api.server`.

**Atomic gate:** do not add rows to `scripts/module-boundary-allowlist.json`. Before closing boundary / schema / door work, `npm run check:atomic` ([decision](./decisions/2026-11-15-atomic-guardrails.md), `sf-atomic-guardrails.mdc`).

## Docs index

| Use for | Doc |
| --- | --- |
| This queue, routes, secrets, open work | This file |
| Glossary / agent index | [glossary](./glossary.md), [AGENTS.md](../../../AGENTS.md) |
| Ops / launch runbooks | [production-env-checklist](../../ops/production-env-checklist.md), [deploy](../../ops/deploy.md), [backup-restore](../../ops/backup-restore.md), [migration-users-events](../../ops/migration-users-events.md), [redirects-and-archive](../../ops/redirects-and-archive.md), [cutover](../../ops/cutover.md), [post-launch-first-week](../../ops/post-launch-first-week.md) |
| Dev setup / admin tour | [local-setup](../../dev/local-setup.md), [troubleshooting](../../dev/troubleshooting.md), [admin-tour](../../dev/admin-tour.md) |
| Accepted decisions | [decisions/](./decisions/) |
| ACL levels and optional audit | [2026-11-16-acl-levels-and-audit](./decisions/2026-11-16-acl-levels-and-audit.md) |
| Payload peel | [payload-dependency-map](../../archive/payload-dependency-map.md), [2026-11-15-payload-peel](./decisions/2026-11-15-payload-peel.md) |
| Pages pack | [pages-pack-plan](./pages-pack-plan.md) |
| Social standing (Active polish; Marketplace next) | [social-module-standing](./social-module-standing.md) |
| Marketplace pack plan (slice 4 public loop in tree) | [marketplace-pack-plan](./marketplace-pack-plan.md), coding slices [marketplace-build-spec](./marketplace-build-spec.md) |
| Ads pack plan | [ads-pack-plan](./ads-pack-plan.md) |
| PrimeOne packs | [primeone-coverage-plan](./primeone-coverage-plan.md), [primeone-pack-plans](./primeone-pack-plans.md) — Onboarding slice 2 in tree ([spec](./onboarding-build-spec.md), [plan](./onboarding-pack-plan.md)); Fleet and Documents still parked ([fleet spec](./fleet-build-spec.md), [documents spec](./documents-build-spec.md)); later [ledger](./ledger-pack-plan.md), [warehouse](./warehouse-pack-plan.md) |
| Base vs advanced class test | [2026-11-26-base-vs-advanced](./decisions/2026-11-26-base-vs-advanced.md) |
| Chat, Shop, and live video | [2026-11-26-chat-shop-stream](./decisions/2026-11-26-chat-shop-stream.md) |
| Core finish archive | [core-finish-instructions](../../archive/core-finish-instructions.md) |
| Layer placement | [platform-module-layers](./platform-module-layers.md) |
| Commerce contract | [payments-cart-plan](./payments-cart-plan.md), [payments-merchant-plan](./payments-merchant-plan.md), `sf-payments-module.mdc` |
| Manifest shape | [design-module-boundary](./design-module-boundary.md) — contract; ignore 3 Nov status |
| Security / deploy targets (history) | [design-security](./design-security.md), [design-data-deploy](./design-data-deploy.md) |
| ASN surface inventory | [asn-modules-wireframe](./asn-modules-wireframe.md) — inventory only; ignore §3 as a queue |
