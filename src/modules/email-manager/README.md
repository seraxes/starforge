# product:email-manager

Shared automatic / conditional email pack. **Transport = Core Mailer** (Site Chrome enable / provider / From; secrets in env). Modules emit named triggers; this pack matches rules + templates and calls `Mailer.send`.

Also owns **paced broadcasts**: callers pass a template id + recipient rows; this pack batches (default 20) and waits (default 10 minutes) so a few hundred addresses are not blasted in one request. Also owns a **light campaign** (label + template + pasted recipients). **Send** copies the saved paste into `enqueueEmailBroadcast` (`sourceKey` `email-campaign:<id>`), status moves draft → sending → sent/cancelled/failed from the broadcast row, and counts are the broadcast counters. The campaign editor lists broadcast recipient rows (address, status, error), filtered and capped at 200. Open/click tracking and a durable subscriber list stay out. Future `product:campaigns` still owns a durable subscriber list / segments — that pack stays parked.

## Owns

Named triggers → rules + templates → `Mailer.send`. Paced broadcasts (template id + recipient rows; batch default 20, wait default 10 minutes). Light campaign (label, template id, pasted recipients; Send → one paced broadcast). Thin `sf_email_sends` send log. Not Core Mailer transport; not `product:campaigns` durable subscriber lists/segments.

## Consumes

- **`product:rich-editor`** — HTML template bodies use `RichEditor` with `preset="email"` + `sanitizeEmailHtml` (absolute image/link URLs on save). Pass `MediaPicker` from `@/modules/media/api` for image insert. Bind via `@/modules/rich-editor/api` (server sanitize: `api.server`).
- **`product:media`** — the template editor passes that pack’s `MediaPicker` into the rich editor.
- **Core Mailer** — Site Chrome enable / provider / From; secrets in env.

## Public door

`@/modules/email-manager/api` and `@/modules/email-manager/api.server`:

```ts
import { FORM_SUBMITTED_TRIGGER, listEmailTriggers } from '@/modules/email-manager/api'
import { emitEmailTrigger, enqueueEmailBroadcast } from '@/modules/email-manager/api.server'
```

Soft-fails when the module is off, Chrome email is off, or SMTP/Resend secrets are missing. Forms success mail uses this pack only (`ensureFormsEmailStartersSeeded`); Core Forms never falls back to `getMailer()`. Product packs never call `getMailer()` for bulk lists — use `enqueueEmailBroadcast`. **Broadcast rules:** dedupe addresses; hard cap 2000; refuse a second enqueue while the same `sourceKey` is `queued` / `running`; pace copied onto the broadcast row at enqueue; drain via JobRunner with durable `nextRunAt` (`kickDueBroadcasts`); process boot calls `bootEmailManager` once (`ensureEmailBroadcastDrainJob` + `kickDueBroadcasts`) when the module toggle is on. Campaign Send uses that same pipe with `sourceKey` `email-campaign:<id>` (marketing send type) and does not export campaign helpers on the public door.

## Send log (D3)

Thin `sf_email_sends` rows are written on every Core Mailer send (success / fail / skipped) via a soft wrapper. Dashboard card `email.sent` counts `status = sent` by type (transactional / marketing / system). Log write soft-fails if the table is missing.

## Admin

- `/admin/email` — rules (filter by module category)
- `/admin/email/templates` — list + Add + / test-send dialog; edit at `/admin/email/templates/[id]` (full-page mosaic; label/module in Details popup; plain text + optional email-safe HTML via Rich editor)
- `/admin/email/sends` — recent send log (when / to / type / status / title)
- `/admin/email/broadcasts` — pace rules (batch / gap) + broadcast queue (Pause / Resume / Cancel)
- `/admin/email/campaigns` — campaigns (label + template + pasted recipients). Click the label (or Edit) to expand a half-width mosaic editor on the list (Subscriptions chrome). Send queues one paced broadcast; the expand shows broadcast counts and a filtered recipient table from `sf_email_broadcast_recipients` (capped at 200; Pause / Resume / Cancel stay on Broadcasts). Legacy `/admin/email/campaigns/[id]` redirects to the list.

Toggle under **Settings → Modules**. Email Manager’s manifest `requires: ['product:rich-editor', 'product:media']`. Auth recovery Mailer paths stay direct in v1 (triggers are registered for later).

## Migrations

- `0035_email_broadcasts` — `sf_email_broadcasts` + `sf_email_broadcast_recipients`
- `0057_email_campaigns` — `sf_email_campaigns` + `sf_email_campaign_recipients`
