# Email settings + Mailer port (SF-96)

Thin infrastructure port so Forms (and later forgot-password) send mail without hard-coding a vendor. Aligns with [replaceable-modularity-plan](./replaceable-modularity-plan.md): Chrome policy + env secrets; one active adapter at boot/send time.

## Scope

1. **Site Chrome** — enable, provider (`console` | `smtp` | `resend`), default From address. No API keys / SMTP passwords in DB.
2. **`Mailer` port** — `send({ to, from, subject, text, html? })` + `info()` readiness. Factory picks adapter from Chrome (+ env for secrets).
3. **Adapters** — `console` (local/dev log), `smtp` (nodemailer + env host/user/pass), `resend` (HTTP API + `RESEND_API_KEY`).
4. **Forms** — replace stub `dispatchFormEmailNotify` with real `Mailer.send`; Forms Settings shows platform transport status; per-form / module From overrides Chrome default when set.

## Out of scope

- Forgot password / username flows (SF-17 — unblocks after this lands)
- Queues / retries / templates engine
- HTML email designer

## Env (secrets only)

| Var | Used by |
| --- | --- |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE` | smtp |
| `RESEND_API_KEY` | resend |

Optional: `STARFORGE_MAIL_FROM` as ops override when Chrome From is empty.

## Success

- Disabled Chrome email → notify plans skip send (submission still succeeds).
- Console adapter logs intents locally with no network.
- SMTP / Resend send when enabled + secrets present; misconfig returns soft error without failing form submit.
