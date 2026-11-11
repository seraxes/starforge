# Starforge architecture — current

**Status:** live map as of 2026-11-10. **This page wins** when it disagrees with an older plan, a preference bullet, or a status table.

Read this before [design-system-overview](./design-system-overview.md) (3 Nov snapshot), [core-remaining](./core-remaining.md), [asn-modules-wireframe](./asn-modules-wireframe.md) §3, or [replaceable-modularity-plan](./replaceable-modularity-plan.md). Those stay as history and as design detail. They are not the queue.

## What this platform is

Starforge is the reusable starter: auth, the layout host, Payload as the content module, and toggleable packs. ASN 2.0 is a later **Hero** (theme + airsoft rules) on top of those packs. It does not fork them.

Three layers, unchanged: **Core** hosts and ports, **Modules** are one engine per product concern, **Hero** is brand and vertical rules. Placement table: [platform-module-layers](./platform-module-layers.md). Ownership test: [sf-module-ownership](../../../.cursor/rules/sf-module-ownership.mdc).

## Routes

| Surface | Path |
| --- | --- |
| Core admin | `/admin` (root = Dashboard) |
| Payload CMS | `/cms` (editor at `/cms/admin`) |
| Public site | `/[locale]/…` |

Older sentences that say Core lives at `/app/admin` and Payload lives at `/admin` are obsolete (SF-213).

## Admin chrome

Follow [sf-ui-design](../../../.cursor/rules/sf-ui-design.mdc). Copy Events or Page Settings.

- **Canvas builders** (Layout, Form builder) autosave when the value changes. Not on focus alone.
- **Entity cards** (Events, Venues, Payments, module settings) keep bottom-right Apply / Save / Cancel. Do not strip those buttons to match canvas autosave.
- Admin is blue Gantry chrome. Orange is the primary Save / rare CTA. Payload admin uses the same tokens (`payload-chrome.css`). It is not left on the Payload default skin.

## Secrets

| Kind | Home |
| --- | --- |
| Site-wide (`PAYLOAD_SECRET`, `BETTER_AUTH_SECRET`, platform gateway, SMTP, Turnstile, `REDIS_URL`, API keys) | Process env / gitignored Environment overlay. Never `site_settings`, never a Chrome field. |
| Per-merchant gateway and Billingo / Számlázz keys | Encrypted `sf_pay_merchant_credentials`. Not Site Chrome env. Never plaintext. Never logs. |

The second row is the exception to “secrets never in the database.” Do not “fix” it by moving merchant keys into the env file, and do not store site-wide secrets in jsonb because the merchant table exists.

## Editors

`product:rich-editor` (TipTap, sanitized HTML) is the default for module fields and the page body. `product:lexical-editor` stays an optional pack for anyone who prefers Lexical, including after existing pages have been converted. It is off unless that install chooses it. Both are editor packs. Do not delete Lexical once migration is done.

## One canvas (decided 2026-11-10)

One implementation for a behavior. The layout canvas is that implementation for arranging sections, rows, and percent-width slots.

The Form builder is that same canvas (`src/app/(frontend)/admin/canvas/section-row-canvas.tsx`) with a field palette instead of a particle palette. It leaves out outlines, skin, inherit/copy, full-vs-boxed section width, particle config, and custom HTML/JS. It keeps the layout drag, the percent resize, the empty-row control, and drag-from-anywhere. Field schema, conditions, and validation stay form data. They open from the slot cog.

Empty-row ids come from `nextEmptyRowId` in `src/core/modules/empty-row-id.ts`. Width math stays in `src/core/modules/grid.ts`. Do not add another drag stack. Nav item order and event tier order may still use dnd-kit; those are lists, not this canvas.

## Installer (decided 2026-11-10)

Installing Starforge means choosing which modules come with that site. The mechanism is the one in [module-install-packages](./module-install-packages.md): `modules:wizard` writes the allowlist, `modules:sync` downloads only those packs, `modules:generate` wires them. Site Settings → Modules only hides a pack that is already installed. It does not remove code.

**Always present:** the host Starforge cannot boot without. Auth, users and groups, the admin shell, the module installer itself, the layout document and particle slots, Nav, Site Chrome, Page Settings, the Skin port, the i18n routing host, and the Mailer and cache interfaces.

**Not downloaded unless chosen:** any product engine, including ones that sit in `src/core` today. Forms, the media library, redirects, TipTap, Lexical, search, Email Manager, Payments (gateways, NAV, Billingo, Számlázz), Maps (Leaflet), Events, Profiles, Consent’s banner, and PWA. Adding one later is a new install and a new build, not a checkbox over code that was already on disk.

**Content manager:** Payload is the first content-manager pack, chosen so Starforge did not have to build its own page editor. It is optional at install. Another content manager is another pack behind the same read API the layout uses: published page by slug, draft preview, and the list search and the sitemap need. Do not build that second pack until one is actually chosen. Pages, search, the sitemap, the media store, and site settings still call `getPayload()` from Core, so Payload is not optional yet.

The content manager owns editorial pages (body, drafts, versions, the editor UI). The media library and site settings stay Starforge modules and Core tables. A different page editor must not replace those.

`modules:sync` does not do this yet. It only adds or removes `@starforge/module-*` packages, and only notice-bar and consent are real packages. Forms, media, payments, maps, and the rest are still inside this repo, so every install downloads them. Moving those engines out so an unchosen pack is absent from disk is the modularity target. Do not treat “the admin toggle is off” as that target.

## Build queue

Core → Modules → Hero still holds. **The active job is to finish and polish Core.** Do not open another product pack, and do not extend Events, Maps, or Payments, until that pass is done. “Done enough” is not the bar.

Do not re-open work that already shipped: RateLimiter, captcha-in-security, the manifest host (M0–M2), Redis cache, the Skin port, dashboard D2–D4, the email send log, module info pages, or the dashboard core glance and needs-attention rail (`system.health`, `chrome.posture`, `modules.summary`, `attention.rail`).

**Host gaps for Auto** (one slice per chat, instructions in [core-host-gaps-brief](./core-host-gaps-brief.md)): all five slices shipped — public error/404, optional email verification, download-my-data / delete-my-account, job-runner port (`src/core/jobs`), and Google sign-in (`GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`, button only when both set). These do not replace the list below.

**Now (Core finish), in order:**

1. **Small host leftovers.** Consent category UI, redirect CSV import, and a dynamic admin-theme CSS import (the registry works; layouts still import Gantry statically). Fold Forms success mail onto Email Manager only — `src/core/forms/email-notify.ts` still calls `getMailer()` as well as `emitEmailTrigger`.
2. **Structural finish, its own pass.** Move the Forms and Redirects engines out of `src/core` (manifest plan M3–M4). Not a side effect of a feature PR. The TipTap engine can follow the same way; do not start that extract just to fix the `MediaPicker` import.

**Particle defaults are not a Core admin page.** They are demo content inside a skin pack: the particles that ship with that skin already have default text and parameters, so an installed skin is not empty. Build that when Starforge is ready to hand to other people as a demo. Do not add `/admin/particle-defaults` back.

**After Core is finished, commercial order** (ownership unchanged; this is not the active queue): close paid event tickets on `product:payments`, then `product:subscriptions`, then `product:ads`. `sf_pay_collect_entitlements` stays frozen until subscriptions owns it.

**Also decided, and also waiting:** event slot kinds are choosable **Ticket type**, **Booking type**, and **Faction**, and an admin can add other names. The code today is only `general | faction`. Do not build that chooser during the Core pass.

**Parked until Core is finished, and not ahead of the commercial order after that:** TacMap stations, BLE beacons, `apps/asn-capacitor`, Shop, Marketplace schema, Social, Chat, Stream, Notifications, ASN Hero theme and domain fields, DigitalOcean, WordPress migration.

The 5 Nov wireframe order does not override this. Email Manager already shipped ahead of the heavy packs. i18n P0–P3 already shipped.

## Languages

One outline for every language. Do not copy a layout per locale. Particle chrome (account menu, sign-in, locale switcher) reads the message catalog for the current `[locale]`. Page body stays in the content manager.

Editor-typed text uses one field. Localization owns that control (`LocaleInput`). It shows a language menu on the end of the field only when more than one public locale is enabled. Custom particle HTML and title use it. Custom CSS and JavaScript do not.

**Content locale files:** non-default (and mirrored default) layout/nav strings persist under `data/content-locales/{locale}/layouts|nav/{id}.json` as flat maps of stable keys → strings. The key *is* belonging (`layout.{layoutId}.slot.{slotId}.{field}`, `nav.{menuId}.item.{itemId}.{field}`). Runtime resolves via `pickContentLocaleText`. `/admin/localization` has a CodeMirror JSON editor plus download/upload. UI chrome packs (`src/core/i18n/messages`, module `messages/`) and Payload CMS locales stay separate.

## Hero vs module

| Belongs in the module | Belongs in Hero |
| --- | --- |
| Maps rooms, teams, roster, same-team GPS | ASN map chrome, beacon SKUs, `apps/asn-capacitor` |
| Event slot kinds: choosable Ticket type, Booking type, Faction, plus admin-added names | Milsim sheets, association membership, TEÁOR, field-safety policy |
| Profiles `extensions` jsonb | ASN team / airsoft fields inside that jsonb |
| Public pastel look | A second skin pack plus domain rules |

Those kind names live in Events. They are not a license to add airsoft columns to `sf_events_*`. Code today is still the closed pair `general | faction`.

## Accepted transitions

Do not relocate these in a drive-by:

| Thing | Where it lives | Rule |
| --- | --- | --- |
| Forms engine | `src/core/forms` + `product:forms` manifest | Destination is an install pack that is absent when not chosen. Stays here until that extract. |
| Redirects engine | `src/core/redirects` + `product:redirects` manifest | Same. |
| TipTap engine | `src/core/rich-editor` + `product:rich-editor` | Same. Lexical too. |
| `RichEditor.tsx` imports `MediaPicker` from `@/modules/media` | Known Core → module break | Fix by passing the picker in when that file is next touched. Do not start an M4 extraction to “solve” it. |
| Forms `email-notify.ts` calls `getMailer()` and `emitEmailTrigger` | Legacy dual path | New mail uses Email Manager only. Do not copy `getMailer()` into another pack. |
| `sf_pay_collect_entitlements` | Frozen stub inside Payments | Subscriptions replaces it. No plan/period columns on `sf_pay_*`. |
| Payment fulfillment | `registerPaymentConsumerHook('events.confirmRegistration', …)` | One hook key per consumer, passed into checkout. No second event bus. |

New packs follow Payments: a **port** in `src/core/<port>`, **product behavior** in `src/modules/<id>`. A PR may touch Core when it adds a port or a host extension. It does not put product screens, catalogs, or fulfillment in Core.

## Ports already real

Shipped, do not re-plan: Mailer, PublishedContentCache, Redis client, MediaStorage, RateLimiter, Captcha (`src/core/security`), admin theme, Skin (`src/core/skin`), RealtimePort (foundation), MapProvider (`src/core/maps`, leaflet-osm), Payments (`src/core/payments`: gateways, FiscalProvider, BillingProvider).

Still paper, and only when a consumer is actually being built: `LlmProvider`, `MediaAnalysisPort`. No stub port without a consumer.

## Docs

| Use for | Doc |
| --- | --- |
| This queue, routes, secrets, hero line | This file |
| Layer placement | [platform-module-layers](./platform-module-layers.md) |
| Commerce contract | [payments-cart-plan](./payments-cart-plan.md), [payments-merchant-plan](./payments-merchant-plan.md), `sf-payments-module.mdc` |
| Manifest shape | [design-module-boundary](./design-module-boundary.md) — contract still valid; 3 Nov status and the “diff touches only `src/modules`” acceptance test are not |
| Security and deploy targets | [design-security](./design-security.md), [design-data-deploy](./design-data-deploy.md) |
| ASN surface inventory | [asn-modules-wireframe](./asn-modules-wireframe.md) — inventory only; ignore §3 as a queue |
