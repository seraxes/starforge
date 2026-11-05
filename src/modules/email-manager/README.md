# product:email-manager

Shared automatic / conditional email pack. **Transport = Core Mailer** (Site Chrome enable / provider / From; secrets in env). Modules emit named triggers; this pack matches rules + templates and calls `Mailer.send`.

## Public API

```ts
import { FORM_SUBMITTED_TRIGGER, listEmailTriggers } from '@/modules/email-manager/api'
import { emitEmailTrigger } from '@/modules/email-manager/api.server'

await emitEmailTrigger({
  triggerKey: FORM_SUBMITTED_TRIGGER,
  payload: { formTitle: 'Contact', notifyAdmin: true, adminEmails: ['a@b.c'], payloadText: '…' },
})
```

Soft-fails when the module is off, Chrome email is off, or SMTP/Resend secrets are missing.

## Send log (D3)

Thin `sf_email_sends` rows are written on every Core Mailer send (success / fail / skipped) via a soft wrapper. Dashboard card `email.sent` counts `status = sent` by type (transactional / marketing / system). Log write soft-fails if the table is missing.

## Admin

- `/admin/email` — rules (filter by module category)
- `/admin/email/templates` — templates + test send
- `/admin/email/sends` — recent send log (when / to / type / status / title)

Toggle under **Settings → Modules**. Auth recovery Mailer paths stay direct in v1 (triggers are registered for later).
