---
kind: live
last_verified: 2026-11-28
---
# Starforge architecture — current

Last verified against code: 2026-11-28 (Social polish Active; Marketplace slices 1–10 local loop in tree; Onboarding slices 1–12 in tree including Documents bridge (slice 6), default off; Documents slices 1–5 bind/list/render/admin/signing in tree, default off; Chat and Shop after Marketplace; live video stays in Social; Fleet stays parked; Scan plan only — not scaffolded).

**This page wins** when it disagrees with an older plan, preference bullet, or status table. Plans and audits are history.

## What this platform is

Reusable starter: auth, layout host, content manager behind PageReadsPort, toggleable packs. ASN 2.0 / Airsoft Nexus is a later Hero on those packs; InspecTra may ship earlier.
**Core** — host + ports (including the signature port under `src/core/signatures`). **Base** — a product pack that depends only on Core. In tree: Media. **Advanced** — a product pack that `requires` another module: Forms, Rich editor, Email Manager, Payments, Profiles, Maps (in progress), Events, Subscriptions, Social (live video stays here — no `product:stream`), Marketplace (slices 1–10 local loop in tree), Onboarding (PrimeOne, slices 1–12 including Documents bridge in tree, default-off), Documents (PrimeOne, slices 1–5 bind/list/render/admin/signing in tree, default-off; Fleet stays parked), Chat and Shop (after Marketplace), Ads (catalog + admin / default-off; parked until after Marketplace — plan: [ads-pack-plan](./ads-pack-plan.md)). Support stays later. **Hero** — brand + vertical rules, not a module.
`product:pages` is the content manager (site pack), not a base engine. Base modules are not Core. Class test: [2026-11-26-base-vs-advanced](./decisions/2026-11-26-base-vs-advanced.md).
Placement: [platform-module-layers](./platform-module-layers.md). Rules: [sf-architecture](../../../.cursor/rules/sf-architecture.mdc), [sf-module-ownership](../../../.cursor/rules/sf-module-ownership.mdc).

## Launch scope

Accepted: [2026-11-22-launch-scope](./decisions/2026-11-22-launch-scope.md).

- **First production site:** Airsoft Nexus — every module already built; Lexical may stay off.
- **Earlier site allowed:** InspecTra (quality inspection) may ship before Airsoft Nexus; Core polish comes first.
- **Do not archive built modules.** Nothing built stays off except the possible Lexical exception.
- **Absent until built:** Chat and Shop, after Marketplace (and any other pack not in the tree). There is no `product:stream`; live video is part of Social ([2026-11-26-chat-shop-stream](./decisions/2026-11-26-chat-shop-stream.md)). Ads is in tree (`src/modules/ads`, default-off) with catalog schema + `/admin/ads`; Payments bridge / Social publish parked until after Marketplace (and other major advanced modules). Marketplace slices 1–10 (local loop) are in tree: door, categories, listings/settings, public loop, saves, inquiries/offers, ratings, dashboard counts, optional listing fee (`marketplace.listingFeePaid`; default off), and Social feed share. Onboarding slices 1–12 are in tree (`defaultEnabled: false`); slice 12 is the driver-home particle; slice 6 is the Documents bridge (training PDF through `renderDocumentTemplate` when Documents is on).
- **Migrate:** users, avatars, profile settings (new password on first login — do not migrate passwords); upcoming events only (past events stay archived on the old site); marketplace user ratings. Marketplace posts = later examination, not a cutover requirement. Everything else stays on the old site.

## Build queue

Core → base → advanced → Hero still holds. Core finish (slices 1–9) and the base-module pass items that were open on this map (requires-graph auto-enable, Payments `requestOrderRefund`, Forms CSV / stringConstraints / success redirect, Mailer transactional helper, admin theme CSS from the registry) are in tree. Paid event tickets and the Subscriptions lifecycle are in tree. `sf_pay_collect_entitlements` stays a frozen stub; collect reads `payments.collect` when Subscriptions is on. Social enablement blockers (media attach/serve, staff private-read, write rate limits) are **Done** — see Open work rows below.

| Lane | What |
| --- | --- |
| **Active** | Social polish and complete (enablement blockers Done). Close remaining Social Open work / UX leftovers before turning Social on for cutover. Brief: [social-module-standing](./social-module-standing.md). Core / launch polish in parallel where it blocks cutover. |
| **In progress** | TacMap (`product:maps`). Venue pins and live rooms are in tree. Stations, BLE beacons, and `apps/asn-capacitor` stay parked. This does not jump ahead of Social polish or Marketplace. |
| **Next after Social** | Marketplace local-loop slices 1–10 are in tree (Social share done) — [marketplace-build-spec](./marketplace-build-spec.md). Do not start Ads, Chat, or Shop ahead of Marketplace cutover needs unless the live map moves. |
| **PrimeOne** | Onboarding (`product:onboarding`). Slices 1–12 are in tree. Slice 12: `driver-home` particle plus frontend views Apply (`/onboarding/apply`) and My onboarding (`/account/onboarding`). `sf_onboarding_dashboard_tiles` (title, icon, URL, order, published, status ids, staff-only) and optional status `pageId`. Slice 6: training PDF calls `renderDocumentTemplate` when Documents is on (subject `onboarding`, report id, template `training-report`); pack-local PDF while Documents is off; authz-disabled door leaves report `mediaId` unchanged. Event types are a staff catalog (`sf_onboarding_event_types`): add, deactivate, delete. Seeds ridealong, testday, trialday, and trainingday stay enabled. Delete is refused while a person card uses the key. `defaultEnabled: false`. Spec: [onboarding-build-spec](./onboarding-build-spec.md). Documents (`product:documents`) slices 1–5 are in tree (`runDocumentsDoor`, `listDocumentLinks`, `bindDocumentMedia`, `renderDocumentTemplate`, `sendDocumentForSignature`, `applyDocumentSignatureWebhook`, `sf_documents_links` status/provider/envelope/generation, `sf_documents_templates`, `sf_documents_signature_receipts`, Core `src/core/signatures` DocuSign adapter, `/admin/documents`, ACL `admin.documents`, Onboarding person-card deep link; `defaultEnabled: false`; hard `requires` Media) — [documents-build-spec](./documents-build-spec.md). Signing stays in that pack ([2026-11-27-documents-signing](./decisions/2026-11-27-documents-signing.md)); no `product:signatures` / `product:contracts`. Fleet stays parked. |
| **After Marketplace** | Chat and Shop. Live video is not a pack in this lane; it belongs to Social. |
| **Parked** | Ads (slice 2 catalog + admin in tree / default-off; resume after Marketplace and other major advanced modules — [ads-pack-plan](./ads-pack-plan.md)), Notifications, ASN Hero theme / currency / `apps/asn-capacitor`, TacMap stations / BLE beacons, durable `product:campaigns`, organizations, support, outbound webhooks. Fleet (plan and build spec written — [fleet-build-spec](./fleet-build-spec.md), [primeone-pack-plans](./primeone-pack-plans.md); do not scaffold; not in this queue). Scan (`product:scan`, plan written — [scan-pack-plan](./scan-pack-plan.md); do not scaffold; not in this queue). Ledger and warehouse later ([ledger-pack-plan](./ledger-pack-plan.md), [warehouse-pack-plan](./warehouse-pack-plan.md)). |

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
| Modules form must not wipe the catalog | Core settings | Done. Settings → Modules reads the live row (same as the admin sidebar). One save may turn off one catalog id; more than one is refused and not written | yes | [2026-11-27-modules-toggle-mass-off](./decisions/2026-11-27-modules-toggle-mass-off.md), `src/core/settings/actions.ts`, `src/app/(frontend)/admin/settings/page.tsx` |
| Seed refuses production; README must not treat the seed password as production | Core seed / README | Done; `assertSeedAllowed` refuses `NODE_ENV=production` unless `STARFORGE_ALLOW_PRODUCTION_SEED=1`. README warns local-only | yes | `src/seed-production-guard.ts`, `src/seed.ts`, `README.md` |
| Env validation rejects placeholder secrets | Core env | Done; production errors on `.env.example` values and secrets containing `dev-only` / `change-me`; CI `ci-only-*` secrets are not placeholders; dev/test warn only | yes | `src/core/env/validate.ts` |
| Dedicated payment-credentials key required in production | Payments | Done; production requires non-placeholder `SF_PAY_CREDENTIALS_KEY` (no `PAYLOAD_SECRET` / hardcoded fallback); dev may still fall back | yes | `src/modules/payments/credentials-crypto.ts`, `src/core/env/validate.ts` |
| Production warning when `STARFORGE_TRUSTED_PROXY_HOPS` is unset | Core env | Done; production warns (not errors) when unset/empty; non-integer stays a warning; CI boots without the key | yes | `src/core/env/validate.ts` |
| Social `optionalRequires` contains particle id `form` | Social | Confirmed: `form` is `src/modules/form` (`kind: 'particle'`). Keep or drop is undecided. Only if Social is on | only if Social is on | `src/modules/social/manifest.ts`, `src/modules/form/manifest.ts` |
| Rename `product:maps` to TacMap (id / docs consistency) | Maps | Open; do not rename in the Social dependency slice. Pack README already brands TacMap. Maps stays in progress | no | [2026-11-22-social-dependency-floor](./decisions/2026-11-22-social-dependency-floor.md), `src/modules/maps/README.md` |
| Manifest `layer` vs base/advanced class test | Core boot | Open. The class test is accepted. Do not retag `layer` until a site pack no longer `requires` a pack that would boot later (`product:pages` requires the rich editor). Boot order stays base, then site, then advanced | no | [2026-11-26-base-vs-advanced](./decisions/2026-11-26-base-vs-advanced.md), `src/core/modules/boot-order.ts` |
| Event / page conversation UI on Social’s comments engine | Social (+ Events / Pages) | Accepted ownership; event conversation not built | no | [2026-11-22-comments-reports-ownership](./decisions/2026-11-22-comments-reports-ownership.md) |
| Rich-editor TipTap toolbar emoji button | Rich editor | Open; Social plain-field composers already use `EmojiInsertButton` | no | `src/modules/rich-editor/EmojiInsertButton.tsx` |
| `dangerouslySetInnerHTML` sites need a sanitization review | Core + packs | Open; custom particle HTML, page-settings inject, Events description, and others | no | e.g. `src/core/modules/particles/custom.tsx` |
| Event slot kinds chooser (Ticket type / Booking type / Faction + admin names) | Events | Decided; code still `general \| faction` | no | `src/modules/events/schema.ts` |
| Organizations, outbound webhooks, support | TBD | Parked; not ahead of Marketplace | no | — |
| Onboarding | DSP | Slices 1–12 in tree (`defaultEnabled: false`). Slice 6: Documents bridge — training PDF calls `renderDocumentTemplate` on the `documents-api-server` door (`@/modules/documents/api.server`) when Documents is on (subject `onboarding`, subject id = training report id, template `training-report`); stores returned `mediaId` on `sf_onboarding_training_reports`; Documents off → pack-local `renderTrainingReportPdf` + Media ingest; authz-disabled door leaves report `mediaId` unchanged and does not write pack-local PDF. Licence / health / contract stay on `sf_onboarding_document_slots`. `optionalRequires`: Documents. Slice 12: `driver-home` particle (pack off / no signed-in person → nothing); status message, action chip, tiles from `sf_onboarding_dashboard_tiles` (title, icon, URL, order, published, status ids empty = every status, staff-only); optional status `pageId` (Pages owns the article). Slice 11: staff tag catalog (`sf_onboarding_tags` — label, color, to-do, fade); empty label refused; seeds Waiting / On hold / Action required / No response are examples; follow-up stores catalog tag ids only; a tag does not change the person’s status. Event types are a staff catalog (`sf_onboarding_event_types` — key, label, enabled, template id, Forms definition id, date field names, active/completed status ids). Seeds ridealong, testday, trialday, and trainingday start enabled. Empty label and a duplicate key are refused. Deactivate hides a type from the new-event kind list; existing person cards keep it. Delete is refused while a person card uses the key. Deleting a card does not delete the type. Depots (`sf_onboarding_depots` short name + address) are the catalog while Fleet is off; empty depot name refused; moving onto a completed status sets open events of that type to `passed` (not failed / no_show) without changing status from the outcome. Slice 9: Edit opens `/admin/email/templates/[id]?embed=1` in a dialog; Email Manager owns embed and save; empty template id refused. Slice 8: recruiting reminder + invite / event-type template ids. Slice 7: phase, display label, action chip, next-step message; active phase is bookable. Checklist / quiz pass creates a dated qualification and does not move status. `optionalRequires` Fleet waits until that manifest exists. Bookable is active phase or vehicle access. Event outcome does not advance main status. Quiz mode belongs in Forms. Mail copy stays in Email Manager; Onboarding stores the template id. No Core fact-map port | no | [onboarding-build-spec](./onboarding-build-spec.md), [onboarding-pack-plan](./onboarding-pack-plan.md) |
| Documents | DSP | Slices 1–5 in tree (`src/modules/documents`, `defaultEnabled: false`). Door `runDocumentsDoor` / `documents-api`; `listDocumentLinks`, `bindDocumentMedia`, `renderDocumentTemplate`, `sendDocumentForSignature`, and `applyDocumentSignatureWebhook` on `api.server`. Tables `sf_documents_links` (subject kind/id, optional template id, `mediaId`, title, status, provider id, envelope id, generation default 1, created at/by), `sf_documents_templates` (id, title, subject kind, render source, enabled, created/updated at; no PDF bytes), and `sf_documents_signature_receipts` (provider + event id unique). Plain text ids; no FKs. Subjects: `user`, `onboarding`, `fleet_vehicle`. Unique key with template: subject kind + subject id + template id + generation. Empty/draft/sent → render updates that generation; signed → render refuses. Void keeps the generation; next contract is generation + 1. Hard `requires`: Media. Core signature port `src/core/signatures/<id>.ts` (DocuSign first; secrets in env overlay). Admin: `/admin/documents`, ACL `admin.documents`, Onboarding person-card deep link. No `product:signatures` / `product:contracts`. Onboarding slice 6 calls render when Documents is on; pack-local training PDF stays while Documents is off. | no | [documents-build-spec](./documents-build-spec.md), [documents-pack-plan](./documents-pack-plan.md), [2026-11-27-documents-signing](./decisions/2026-11-27-documents-signing.md), [primeone-pack-plans](./primeone-pack-plans.md) |
| Fleet | DSP | Plan and build spec written; pack not scaffolded. Stays parked. | no | [fleet-build-spec](./fleet-build-spec.md), [fleet-pack-plan](./fleet-pack-plan.md), [primeone-coverage-plan](./primeone-coverage-plan.md), [primeone-pack-plans](./primeone-pack-plans.md) |
| Scan (`product:scan`) | Forms + Media | Plan written. Pack not scaffolded. Stays parked. The layers guide still files OCR apps as Hero until a decision accepts this plan | no | [scan-pack-plan](./scan-pack-plan.md) |
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

**Requires chain:** Forms → Media; Rich editor → Media; Email Manager → Rich editor + Media; Payments → Email Manager; Profiles → Media + Forms; Maps → Media. Events requires Forms, Media, Rich editor, Payments, Profiles, Maps. Subscriptions requires Payments, Email Manager, Forms, Profiles. Social requires Profiles, Media, Rich editor, Forms, Email Manager (not Payments, not Maps). Ads requires Social, Email Manager, Forms, Subscriptions, Payments (`optionalRequires`: Media). Marketplace requires Payments, Profiles, Media, and Email Manager (`optionalRequires`: Social, Subscriptions). Local-loop slices 1–10 (including listing fee and Social share) are in tree. It stays advanced. Onboarding requires Forms, Media, Email Manager, and Profiles. `optionalRequires`: Documents; Fleet is omitted until `product:fleet` is a manifest id. `defaultEnabled: false`. Slices 1–12 (including Documents bridge) are in tree. It stays advanced. Documents requires Media. `defaultEnabled: false`. Slices 1–5 (bind/list/render/admin/signing + Core signature port) are in tree. It stays advanced.

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
| `product:marketplace` | Payments, Profiles, Media, Email Manager (`optionalRequires`: Social, Subscriptions) | advanced (slices 1–10 local loop in tree) | `advanced` |
| `product:onboarding` | Forms, Media, Email Manager, Profiles (`optionalRequires`: Documents; Fleet when that pack exists) | advanced (slices 1–12 including Documents bridge + driver-home; default off) | `advanced` |
| `product:documents` | Media | advanced (slices 1–5 bind/list/render/admin/signing; default off) | `advanced` |
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
| TipTap engine | `src/modules/rich-editor` | Callers use `@/modules/rich-editor/api` (+ `api.server` for sanitize/gate). MediaPicker passed in from media. Emoji insert control (`EmojiInsertButton`) for plain text fields; Social composers wired. TipTap toolbar emoji later. |
| Forms success mail | `emitEmailTrigger` only | No `getMailer()` from Forms. |
| `sf_pay_collect_entitlements` | Frozen stub | Subscriptions on → `payments.collect`. |
| Payment fulfillment | `registerPaymentConsumerHook` | One hook key per consumer; later listeners isolated. |
| Online payment gateway | `src/core/payments/<id>.ts` + `register-online.ts` | Developer ships; admin enables + pastes keys. |
| Process boot | `runModuleBoot` then `runHeroBoot` | `instrumentation.ts` asserts env, then both. |
| Page reads | `PageReadsPort` | Layout, search, sitemap use `getPageReads()`. |
| Side-by-side layout sections | `rowContainers` on the layout document | Two or more sections on one line get a row container. It owns container mode and basic section settings. Member sections keep width % and ignore container mode. |
| Admin ACL | Core groups: view / edit / manage | No Access Level entity. App admin bypasses. |
| Staff bypass | App admins + pack `admin.<id>` edit/manage on ownership gates; staff UI additive. Front-end private-read (`only_me` / friends / group) uses the same Social staff grant in `canViewPost` | [2026-11-21-staff-bypass](./decisions/2026-11-21-staff-bypass.md), [2026-11-22-staff-bypass-limits](./decisions/2026-11-22-staff-bypass-limits.md), `sf-staff-bypass.mdc` |
| Admin stays in admin | Admin create/edit/moderate stays under `/admin`. Public member editors are separate. Shared form fields/actions OK; do not bounce admin → public after Edit | [2026-11-27-admin-stays-admin](./decisions/2026-11-27-admin-stays-admin.md), `sf-admin-stays-admin.mdc` |
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
| Marketplace pack plan (slices 1–10 local loop in tree) | [marketplace-pack-plan](./marketplace-pack-plan.md), coding slices [marketplace-build-spec](./marketplace-build-spec.md) |
| Ads pack plan | [ads-pack-plan](./ads-pack-plan.md) |
| Scan pack plan (proposed, not scaffolded) | [scan-pack-plan](./scan-pack-plan.md) |
| PrimeOne packs | [primeone-coverage-plan](./primeone-coverage-plan.md), [primeone-pack-plans](./primeone-pack-plans.md) — Onboarding slices 1–12 in tree including Documents bridge ([spec](./onboarding-build-spec.md), [plan](./onboarding-pack-plan.md)); Documents slices 1–5 (bind/list/render/admin/signing, `sf_documents_links` status/generation, `sf_documents_templates`, `sf_documents_signature_receipts`, Core `src/core/signatures`, `/admin/documents`, `admin.documents`) in tree ([documents spec](./documents-build-spec.md), [documents plan](./documents-pack-plan.md), signing [2026-11-27-documents-signing](./decisions/2026-11-27-documents-signing.md)); Fleet still parked ([fleet spec](./fleet-build-spec.md)); later [ledger](./ledger-pack-plan.md), [warehouse](./warehouse-pack-plan.md) |
| Modules toggle mass-off refuse | [2026-11-27-modules-toggle-mass-off](./decisions/2026-11-27-modules-toggle-mass-off.md) |
| Base vs advanced class test | [2026-11-26-base-vs-advanced](./decisions/2026-11-26-base-vs-advanced.md) |
| Chat, Shop, and live video | [2026-11-26-chat-shop-stream](./decisions/2026-11-26-chat-shop-stream.md) |
| Core finish archive | [core-finish-instructions](../../archive/core-finish-instructions.md) |
| Layer placement | [platform-module-layers](./platform-module-layers.md) |
| Commerce contract | [payments-cart-plan](./payments-cart-plan.md), [payments-merchant-plan](./payments-merchant-plan.md), `sf-payments-module.mdc` |
| Manifest shape | [design-module-boundary](./design-module-boundary.md) — contract; ignore 3 Nov status |
| Security / deploy targets (history) | [design-security](./design-security.md), [design-data-deploy](./design-data-deploy.md) |
| ASN surface inventory | [asn-modules-wireframe](./asn-modules-wireframe.md) — inventory only; ignore §3 as a queue |
