# product:email-manager

Layer: base

Status: shipped

Shared automatic / conditional email pack. **Transport = Core Mailer** (Site Chrome enable / provider / From; secrets in env). Modules emit named triggers; this pack matches rules + templates and calls `Mailer.send`.

Also owns **paced broadcasts**: callers pass a template id + recipient rows; this pack batches (default 20) and waits (default 10 minutes). Also owns a **light campaign** (label + template + pasted recipients). **Send** copies the saved paste into `enqueueEmailBroadcast` (`sourceKey` `email-campaign:<id>`), status moves draft → sending → sent/cancelled/failed from the broadcast row, and counts are the broadcast counters. The campaign editor lists broadcast recipient rows (address, status, error), filtered and capped at 200. Open/click tracking and a durable subscriber list stay out. Future `product:campaigns` still owns a durable subscriber list / segments — that pack stays parked.

## Owns

Named triggers → rules + templates → `Mailer.send`. Paced broadcasts (template id + recipient rows; batch default 20, wait default 10 minutes). Light campaign (label, template id, pasted recipients; Send → one paced broadcast). Thin `sf_email_sends` send log. Tables: `sf_email_templates`, `sf_email_rules`, `sf_email_sends`, `sf_email_broadcasts`, `sf_email_broadcast_recipients`, `sf_email_campaigns`, `sf_email_campaign_recipients`. Not Core Mailer transport; not `product:campaigns` durable subscriber lists/segments.

**Broadcast rules:** dedupe addresses; hard cap 2000; refuse a second enqueue while the same `sourceKey` is `queued` / `running`; pace copied onto the broadcast row at enqueue; drain via JobRunner with durable `nextRunAt` (`kickDueBroadcasts`). Campaign Send uses that same pipe with `sourceKey` `email-campaign:<id>` (marketing send type) and does not export campaign helpers on the public door.

**Send log (D3):** Thin `sf_email_sends` rows are written on every Core Mailer send (success / fail / skipped) via a soft wrapper. Dashboard card `email.sent` counts `status = sent` by type (transactional / marketing / system). Log write soft-fails if the table is missing.

Migrations: `0035_email_broadcasts`, `0057_email_campaigns`.

## Consumes

- **`product:rich-editor`** — HTML template bodies use `RichEditor` with `preset="email"` + `sanitizeEmailHtml` (absolute image/link URLs on save). Pass `MediaPicker` from `@/modules/media/api` for image insert. Bind via `@/modules/rich-editor/api` (server sanitize: `api.server`)
- **`product:media`** — template editor passes that pack’s `MediaPicker` into the rich editor
- **Core Mailer** — Site Chrome enable / provider / From; secrets in env

## Public door

`@/modules/email-manager/api` and `@/modules/email-manager/api.server`:

```ts
import { FORM_SUBMITTED_TRIGGER, listEmailTriggers } from '@/modules/email-manager/api'
import { emitEmailTrigger, enqueueEmailBroadcast } from '@/modules/email-manager/api.server'
```

**`api` (representative):** `BUILTIN_EMAIL_TRIGGERS`, `DEFAULT_EMAIL_MANAGER_MODULE_SETTINGS`, `EMAIL_BROADCAST_*`, `EMAIL_MANAGER_MODULE_ID`, `EMAIL_MODULE_CATEGORIES`, `FORM_*_TRIGGER`, `SYSTEM_TEST_TRIGGER`, broadcast normalize/cap helpers, condition/rule match helpers, `listEmailTriggers`, `getEmailTrigger`, `renderEmailTemplate`, `normalizeEmailManagerModuleSettings`, audience helpers, and related types.

**`api.server` (representative):** `emitEmailTrigger`, `enqueueEmailBroadcast`, `cancelEmailBroadcast`, `pauseEmailBroadcast`, `resumeEmailBroadcast`, `kickDueBroadcasts`, `ensureEmailBroadcastDrainJob`, CRUD for rules/templates, `isEmailManagerEnabled`, `loadEmailManagerModuleSettings` / `saveEmailManagerModuleSettings`, `recordEmailSend`, seed helpers (`seedEmailStarter`, `ensureFormsEmailStartersSeeded`, …), `sendEmailManagerTest`.

Soft-fails when the module is off, Chrome email is off, or SMTP/Resend secrets are missing. Forms success mail uses this pack only (`ensureFormsEmailStartersSeeded`); Core Forms never falls back to `getMailer()`. Product packs never call `getMailer()` for bulk lists — use `enqueueEmailBroadcast`. Door: `email-manager-api-server`.

## Admin surfaces

- `/admin/email` — rules (filter by module category)
- `/admin/email/templates` — list + Add + / test-send; edit at `/admin/email/templates/[id]`
- `/admin/email/sends` — recent send log
- `/admin/email/broadcasts` — pace rules + queue (Pause / Resume / Cancel)
- `/admin/email/campaigns` — campaigns (legacy `/admin/email/campaigns/[id]` redirects to the list)
- ACL area: `email-manager`
- Dashboard: `email.sent`
- Toggle: Settings → Modules

## Boot and jobs

`bootEmailManager` when the module toggle is on: `ensureEmailBroadcastDrainJob` + `kickDueBroadcasts`. Job: `email.broadcast-drain` (JobRunner, durable `nextRunAt`).

## Known gaps

- Auth recovery Mailer paths stay direct in v1 (triggers are registered for later)
- Open/click tracking and durable subscriber lists out of scope (`product:campaigns` later)

## Tests

`src/modules/email-manager/conditions.test.ts`, `template-render.test.ts`, `rule-match.test.ts`, `audience.test.ts`, `triggers.test.ts`, `send-type.test.ts`, `seed-starter.test.ts`
