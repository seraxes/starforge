# product:email-manager

Shared automatic / conditional email pack. **Transport = Core Mailer** (Site Chrome enable / provider / From; secrets in env). Modules emit named triggers; this pack matches rules + templates and calls `Mailer.send`.

Also owns **paced broadcasts**: callers pass a template id + recipient rows; this pack batches (default 20) and waits (default 10 minutes) so a few hundred addresses are not blasted in one request. Future `product:campaigns` still owns newsletter lists/segments — this is the lightweight queue for admin-driven, caller-supplied audiences.

## Owns

Named triggers → rules + templates → `Mailer.send`. Paced broadcasts (template id + recipient rows; batch default 20, wait default 10 minutes). Thin `sf_email_sends` send log. Not Core Mailer transport; not `product:campaigns` newsletter lists/segments.

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

Soft-fails when the module is off, Chrome email is off, or SMTP/Resend secrets are missing. Forms success mail uses this pack only (`ensureFormsEmailStartersSeeded`); Core Forms never falls back to `getMailer()`. Product packs never call `getMailer()` for bulk lists — use `enqueueEmailBroadcast`. **Broadcast rules:** dedupe addresses; hard cap 2000; refuse a second enqueue while the same `sourceKey` is `queued` / `running`; pace copied onto the broadcast row at enqueue; drain via JobRunner with durable `nextRunAt` (`kickDueBroadcasts`); process boot calls `bootEmailManager` once (`ensureEmailBroadcastDrainJob` + `kickDueBroadcasts`) when the module toggle is on.

## Send log (D3)

Thin `sf_email_sends` rows are written on every Core Mailer send (success / fail / skipped) via a soft wrapper. Dashboard card `email.sent` counts `status = sent` by type (transactional / marketing / system). Log write soft-fails if the table is missing.

## Admin

- `/admin/email` — rules (filter by module category)
- `/admin/email/templates` — templates + test send (plain text + optional email-safe HTML via Rich editor)
- `/admin/email/sends` — recent send log (when / to / type / status / title)
- `/admin/email/broadcasts` — pace rules (batch / gap) + broadcast queue (Pause / Resume / Cancel)

Toggle under **Settings → Modules**. Email Manager’s manifest `requires: ['product:rich-editor', 'product:media']`. Auth recovery Mailer paths stay direct in v1 (triggers are registered for later).

## Migrations

- `0035_email_broadcasts` — `sf_email_broadcasts` + `sf_email_broadcast_recipients`
