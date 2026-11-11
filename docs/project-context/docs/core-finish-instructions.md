# Core finish — instructions

**Status:** active queue as of 2026-11-11. Paste **one slice** into a chat. Do not start the next slice in the same chat.

**Resume after sleep (2026-11-11):** start at **slice 5 — Admin audit trail**. Leave slices 1–4 as they stand.

**Read first:** [architecture-current](./architecture-current.md), [sf-ui-design](../../../.cursor/rules/sf-ui-design.mdc), [sf-module-ownership](../../../.cursor/rules/sf-module-ownership.mdc).

The five host slices in [core-host-gaps-brief](./core-host-gaps-brief.md) already shipped. This file is the rest of Core.

## Rules for every slice

- Copy an existing screen. Admin lists copy Redirects or Events. Public consent copy `packages/module-consent`. Account and settings copy Page Settings / Auth settings.
- Card actions sit bottom-right (`page-settings-actions`, `gantry-toolbar-btn`). Fields use `settings-field`.
- One implementation per behavior. No second mailer, drag canvas, media library, form builder, or audit table.
- Secrets stay in the Environment catalog. Never log them. Never write them into an audit row.
- `src/core/**` does not import `@/modules/**` except the known breaks this file names. New code uses `@/core` or `@/generated/*`.
- Do not extend Events, Maps, or Payments. Do not build the packs in [Missing modules](#missing-modules). Do not ship `product:posts` (it is a host placeholder, default off).
- Do not commit unless asked.

## Order

| # | Slice | Kind |
| --- | --- | --- |
| 1 | Consent choices | Host leftover |
| 2 | Redirect CSV import ✅ | Host leftover |
| 3 | Admin theme CSS from the registry | Host leftover |
| 4 | Forms success mail through Email Manager only | Host leftover |
| 5 | Admin audit trail | **Resume here** — host gap added 2026-11-11 |
| 6 | Move the Redirects engine | Structural, own pass |
| 7 | Move the Forms engine | Structural, own pass |
| 8 | Move the TipTap engine | Structural, after 7 |
| 9 | Page reads go through one port | Structural, last |

Particle defaults stay demo content inside a skin pack. There is no `/admin/particle-defaults` page.

---

## Slice 1 — Consent choices

The banner already stores `necessary: true` and `analytics: boolean` in the `sf-consent` cookie. Analytics atoms already wait for `analytics === true`. The banner only offers Essential and Accept all, and it never reopens.

**Do**

- In `packages/module-consent`, add a choices panel: Necessary locked on, Analytics as a checkbox, then save. Same banner button classes.
- Add a third banner action that opens that panel before the visitor has chosen.
- After a choice exists, the banner stays hidden. A compact “Cookie settings” control on the public site reopens the same panel and writes the same cookie and `sf-consent-change` event.
- Keep the cookie client-readable. Necessary stays true. Analytics false means the analytics atom does not load.

**Do not**

- Do not add a marketing or functional category. Nothing gates on one yet.
- Do not store consent in the database.
- Do not add a CMP vendor.

**Done when**

- Essential and Accept all still write the same cookie shape they write today.
- A visitor can turn analytics off after having accepted it, and the analytics atom stays unloaded.
- `npm run test:unit` still passes.

---

## Slice 2 — Redirect CSV import ✅

Rows live in `sf_redirects`: `fromPath`, `toPath`, `statusCode` (301, 302, 307, 308), `enabled`, `note`. Admin is `/admin/redirects`.

**Shipped:** Import card on `/admin/redirects` (`importRedirectsCsvAction` + `parseRedirectCsv` / `importRedirectsFromCsv` in `src/core/redirects`). Header `from,to,status,enabled,note`; invalid rows skipped with imported/skipped counts; matching `fromPath` upserts. Engine stays in Core until slice 6.

**Done when**

- A two-row CSV creates two redirects that the public proxy honors.
- A bad status or a bad path is skipped and the valid rows still import.
- Re-importing the same file does not duplicate rows.

---

## Slice 3 — Admin theme CSS from the registry

`getActiveAdminTheme()` already resolves the theme. Core admin and Payload still import Gantry sheets by path:

- `src/app/(frontend)/admin/layout.tsx` → `themes/starforge-gantry/core-chrome.css`
- `src/app/(payload)/layout.tsx` → `themes/starforge-gantry/payload-chrome.css`

Nested CSS `@import` through `active-core.css` is unreliable under Turbopack. Keep importing CSS from JavaScript with a static path the bundler can see.

**Do**

- Add one map from theme id to those two sheets, next to the existing theme registry. `starforge-gantry` is the only id.
- Both layouts import through that map (a switch on the active id, each arm a static import). The active id still comes from `getActiveAdminTheme()`.
- Leave `active-core.css` and `active-payload.css` as the human pointer, matching the comment that already explains the bundler limit.

**Do not**

- Do not add a second visual theme. Public dark pastel is the Skin port (SF-33), not admin chrome.
- Do not load CSS from the database, from an upload, or from a runtime string.
- Do not put the admin sheet back on the public root layout.

**Done when**

- `/admin` and `/cms/admin` look the same as they do now.
- The only Gantry CSS paths cited by those two layouts live in the theme map.

---

## Slice 4 — Forms success mail through Email Manager only — **shipped**

`src/core/forms/email-notify.ts` is `emitEmailTrigger` only (`product:forms/submitted`). Soft-skips when Email Manager is off or no rule matches. Starter admin + respondent rules live in `src/modules/email-manager/forms-starters.ts` (`ensureFormsEmailStartersSeeded`). Auth stays on `sendAuthMail`; other packs keep their own triggers.

---

## Slice 5 — Admin audit trail

The host records mail sends and payment reasons. It does not record who changed an account, a module toggle, a redirect, or the environment file.

**Do**

- Add one append-only Core table and a single `recordAdminAudit({ actorId, action, target })` helper. Columns: id, actor user id, action key, target type, target id, created at. No JSON dump of the request.
- Write a row after a successful change in these four places: user role, group, disable, or CMS access; Site Settings module on/off; redirect create, update, delete, and CSV import (one row per import, with the count in the action key or target id); Environment editor save. The environment row stores that a save happened. It never stores key names or values.
- Add a read-only `/admin` page for developer-admin, copying the Redirects list density. Newest first. No edit, no delete.
- Members do not see it. A failed mutation writes nothing.

**Do not**

- Do not backfill history.
- Do not log passwords, session tokens, two-factor secrets, or merchant payment keys.
- Do not add a second audit table inside Payments or Events.

**Done when**

- Disabling a user, toggling a module, and saving a redirect each add one row that names the actor.
- An environment save row contains no secret material.
- A non-developer-admin cannot open the page.

---

## Slice 6 — Move the Redirects engine

Own pass. Manifest plan M3. Consent is already `@starforge/module-consent`. This slice is redirects only.

**Do**

- Move `src/core/redirects` into `src/modules/redirects`. The public behavior stays: admin CRUD, CSV import from slice 2, proxy lookup, sitemap toggle.
- The proxy and any Core caller reach redirects through the generated module hook, not through `@/core/redirects`.
- Delete the Core engine files in the same change once the module path is the one that runs.
- Keep Drizzle tables in the module schema file the host already loads (`src/modules/*/schema.ts`).

**Do not**

- Do not change redirect matching rules in this pass.
- Do not extract Forms or TipTap here.
- Do not turn redirects into a Payload collection.

**Done when**

- `src/core/redirects` is gone.
- A redirect created in admin still answers on the public site.
- Core files do not import `@/modules/redirects` internals. They use the generated hook or `@/modules/redirects/api` where a module is allowed to be called.

---

## Slice 7 — Move the Forms engine

Own pass. Manifest plan M4. Do this after slice 4 so the mail path is already Email Manager only.

**Do**

- Move `src/core/forms` (types, expr, logic, evaluate, store, admin actions, presets) into `src/modules/forms`.
- `src/modules/forms/api.ts` is the door: evaluate, presets, `registerFormPreset`, submit. Events, Profiles, and Payments import that door only.
- Delete `src/core/forms` in the same change.
- The form builder stays the layout canvas. Field schema stays form data.

**Do not**

- Do not change conditional logic, math, or the builder UX in this pass.
- Do not start the TipTap move to “solve” `RichEditor` importing `MediaPicker`.
- Do not give Events its own form tables.

**Done when**

- `src/core/forms` is gone.
- Event registration and the profile form still submit.
- A Core file no longer imports the forms engine.

---

## Slice 8 — Move the TipTap engine

Own pass, after slice 7. Lexical stays an optional pack.

**Do**

- Move `src/core/rich-editor` into `src/modules/rich-editor`, matching how the manifest already describes the pack.
- The editor receives `MediaPicker` from the caller (the media module’s `api`). The editor file does not import `@/modules/media`.
- Email template bodies and other current callers keep using the rich-editor public API.

**Do not**

- Do not remove Lexical.
- Do not add a second editor.
- Do not change sanitizer rules in this pass.

**Done when**

- `src/core/rich-editor` is gone.
- A page body and an email template still save sanitized HTML.
- The media picker still inserts an image, and Core does not import it.

---

## Slice 9 — Page reads go through one port

Last structural slice. Payload stays the content manager. This slice makes page reads swappable later. It does not add a second CMS.

**Do**

- One Core port for the four reads the layout host needs: published page by slug, draft preview, the list search uses, and the sitemap entries. The Payload adapter is the only place those four call `getPayload()`.
- Point Nav, the public page route, draft preview, search, and the sitemap at that port.

**Do not**

- Do not move the media library or site settings off `getPayload()` in this slice. List any remaining callers in the port file’s header comment and stop.
- Do not build another page editor.
- Do not change the editorial UI under `/cms`.

**Done when**

- Unpublished slugs still 404. Draft preview still requires CMS access.
- Search and the sitemap still list published pages.
- Those four features no longer call `getPayload()` outside the adapter.

Core is finished when slice 9 is merged. Next product work is the commercial order in [architecture-current](./architecture-current.md): close paid event tickets, then subscriptions, then ads.

---

## Missing modules

These are not the Core queue. Do not build them in a Core slice. Each one is a pack the current map does not name, or names only as an open question. Ownership follows the same test: the module you would delete to remove the concept.

Build them only after Core, and not ahead of paid tickets → subscriptions → ads, except where a row says the pack is part of closing tickets.

| Pack | Owns | Build when | Leave it here if you are tempted to put it elsewhere |
| --- | --- | --- | --- |
| **`product:promotions`** | Coupon and discount codes. Checkout re-resolves the discount server-side and stores the snapshot on the payment line. | With closing paid tickets if a code is required for a ticket to be “sold”; otherwise immediately after tickets, before Shop. | Not a column family on `sf_pay_*`. Not an Events-only code. Events, Shop, and Subscriptions all call it. |
| **`product:organizations`** | Durable orgs (club, company, team-as-membership): roster, who belongs, public org page. Events association / team / club visibility reads this. | When that Events gate is actually built. After Core. Not ahead of the commercial order unless a paid ticket needs the org gate. | ACL groups are permissions, not orgs. Profiles are people. TacMap teams are a match roster inside Maps. Hero airsoft fields stay in `extensions`. |
| **`product:campaigns`** | Broadcast mail: a list, a segment, a send. Transport is the Mailer. Copy and rules UI stay out of it. | When a site needs a newsletter. After Core. Independent of the commercial order. | Email Manager is trigger → template for events that already happened. It is not a mailing list. Campaigns emit nothing of their own SMTP. |
| **`product:comments`** | A thread on a target (page, event, listing) plus an optional score on that target. | Before Social. After Core and after the commercial order. | Social owns the follow graph and the feed. A page comment must not require Social. Do not also create `product:reviews`. |
| **`product:reports`** | “Report this” queue: reporter, target, reason, open/closed. Admin list only. | In the same pass that makes comments or Social public. | Not a trust-and-safety product. Each pack does not get its own report table. |
| **`product:webhooks`** | Outbound signed HTTP when a pack emits a named event. Delivery goes through the job runner. | When the first customer-facing outbound callback is real (form submitted, order paid). | Provider IPN (Stripe, PayPal, Barion) stays inside the payments port. This pack is the site’s own outbound calls. No Zapier builder. |
| **`product:support`** | Ticket queue: status, assignee, replies. Intake is a Forms preset. Replies go through Email Manager. The requester is a Profile. | After the Forms extract, when a ticket desk is needed. Not part of the revenue floor. | Do not build a second field builder for tickets. The Forms “support / ticket” preset is the intake. |

### Already named — do not re-add them as new ideas

Notifications (in-app bell on RealtimePort), Social, Chat, Stream, Shop, Marketplace, Ads, Subscriptions, WordPress migration. `product:posts` stays a placeholder until a Payload collection is chosen. Posts are not a new editor.

### Looks like a missing module, and is not

| Idea | Where it belongs |
| --- | --- |
| Booking calendar separate from events | Events slot kind **Booking type**, already decided, waiting |
| Shipping, inventory, SKUs | `product:shop` |
| VAT, invoices, gateways, merchant keys | `product:payments` and the Core payments port |
| Plans, periods, `canCollectPayments` | `product:subscriptions` |
| Cookie categories | `product:consent` (slice 1). No new pack |
| Protected files | Media ACL, when that media work is scheduled |
| Passkeys, generic OIDC | Core auth, after this finish, one adapter at a time. Google already shipped |
| Site backup, DigitalOcean | Hosting, parked with SF-6 |
| Approval chains beyond draft / publish | Payload versions, until a real multi-step workflow shows up |
| Donations | A payments line plus a form. Not a pack |
| CRM | Organizations + Profiles |
