# Admin Environment editor (configuration.php-like)

Joomla-style env editing from Core admin — **not** secrets in Postgres / Payload / Site Settings / Site Chrome DB fields. Aligns with prefs: secrets stay in env / `.env` only.

## Why (accepted trade-off)

Editing env from a web UI is weaker than files-only ops. The product ask is still: open an Environment panel from Core admin **only behind a strong gate**, like Joomla’s Global Configuration password step, so local/dev (and careful ops) can set Turnstile / SMTP / auth URLs without SSHing every time.

## Non-negotiables

| Rule | Detail |
|------|--------|
| **No DB secrets** | Never write `PAYLOAD_SECRET`, `BETTER_AUTH_SECRET`, Turnstile secret, SMTP pass, Resend key, etc. into `sf_*`, Payload Globals, or Site Chrome JSON. |
| **Gitignored overlay** | Writes go to **`.env.local`** (already gitignored via `.env*.local`). Optional future: `.env.starforge.local` if we need to isolate from hand-edited `.env.local`. |
| **Strong gate** | Panel content unlocks only after **developer-admin** + **confirm password** (re-auth). Short-lived signed httpOnly cookie. |
| **Allowlist only** | UI edits a catalog of known keys — not free-form arbitrary process env dump. |
| **Production default** | **Read-only** when `NODE_ENV=production`, unless ops sets `STARFORGE_ENV_EDITOR=write`. `STARFORGE_ENV_EDITOR=off` forces read-only everywhere. |

## Placement (IA)

- **Site Chrome → Environment** child: `/app/admin/site-chrome/environment`
- Sidebar: Site Chrome group expands to Site Chrome + Environment
- Captcha / Email Chrome hints link here for “keys live in env”

Site Settings stays Modules / toggles — not secrets.

## Gate UX

1. Developer-admin lands on Environment → **locked** screen (password confirm).
2. Server action verifies password via Better Auth email/password for the **current** session email (no email field spoofing).
3. On success: set `sf_env_gate` httpOnly cookie (HMAC with `BETTER_AUTH_SECRET`, ~15 min, path scoped to admin).
4. Unlocked: show allowlisted fields (secrets masked). Save merges into `.env.local`.
5. Lock again: explicit button clears the cookie; cookie expiry also locks.
6. Non–developer-admin: 403-style message (no form). App admin who is not developer-admin cannot unlock.

## Write semantics

- Parse existing `.env.local` (create if missing).
- Update only allowlisted keys present in the submitted form.
- **Secrets**: empty submitted value = **keep** current overlay / effective value (do not wipe). Explicit “Clear” optional later.
- Non-secrets: empty may clear the overlay key (falls through to `.env` / process defaults).
- After write: **restart `next dev` / process** required for Next to reload env (incl. `NEXT_PUBLIC_*`). UI states this plainly.
- Never commit or log secret values.

## Allowlist (v1)

From `.env.example` + Mailer plan:

| Key | Secret? | Notes |
|-----|---------|--------|
| `DATABASE_URL` | yes | Warn: bad value locks DB |
| `PAYLOAD_SECRET` | yes | Warn: session/CMS break |
| `BETTER_AUTH_SECRET` | yes | Warn: sessions invalidate |
| `BETTER_AUTH_URL` | no | |
| `NEXT_PUBLIC_APP_URL` | no | Public; rebuild/restart |
| `STARFORGE_ADMIN_EMAILS` | no | Bootstrap admins |
| `STARFORGE_DEVELOPER_ADMIN_EMAILS` | no | Gate list itself |
| `SF_MODULES` | no | Allowlist override |
| `STARFORGE_CONTENT_CACHE` | no | e.g. `redis` |
| `STARFORGE_MEDIA_STORAGE` | no | `local` / `s3` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | no | Public widget |
| `TURNSTILE_SECRET_KEY` | yes | |
| `STARFORGE_MAIL_FROM` | no | Ops From override |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_SECURE` | pass yes | Mailer |
| `RESEND_API_KEY` | yes | Mailer |
| `STARFORGE_ENV_EDITOR` | no | `write` / `off` / unset |

## Risks vs prefs

| Risk | Mitigation |
|------|------------|
| Secrets in admin session HTML | Mask; never echo full secret back; password autocomplete=off on unlock |
| CSRF / stolen session opens editor | Re-auth password; short gate TTL; developer-admin ACL |
| Writing secrets into DB by mistake | Code path only touches filesystem overlay; prefs + this plan forbid DB |
| Production writable by default | Read-only unless `STARFORGE_ENV_EDITOR=write` |
| Bad `DATABASE_URL` / auth secrets | Warnings in UI; restart required before effect |
| `.env.local` committed | Already gitignored; document in README / `.env.example` |
| Env not live until restart | Explicit post-save message |

Prefs remain: Site Chrome / Settings UI for **policy only** (enable/provider); secret **values** only via env / this gated overlay.

## Out of scope (v1)

- Editing system / Docker-injected env that isn’t file-backed
- Hot-reload of `process.env` without restart
- Auditing every env change to DB (optional later: append-only log of **keys** changed, never values)
- Free-form key editor

## Success

- Plan + gated Environment panel under Site Chrome
- Local/dev can unlock, edit allowlisted keys, persist `.env.local`
- Production shows values (masked) read-only unless explicitly enabled
- No secret columns added to schema / Site Chrome document
