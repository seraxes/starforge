# Starforge core — auth

Product auth / sessions for **app users** (Better Auth + Drizzle + Postgres `public`).

| Concern | Where |
| --- | --- |
| App register / login / logout / session | This module · `/login` · `/register` · `/api/auth/*` · `/api/me` |
| App roles + user admin | `sf_users.role` · `/app/admin/users` (admins only) |
| Site settings + feature toggles | Payload global `site-settings` · `/app/admin/settings` (admins) · also Payload Globals |
| CMS editors (content only) | Payload `users` collection · `/admin` |

Do **not** route high-QPS app login/session traffic through Payload Local API. Payload users and Starforge app users are separate accounts in separate tables/schemas.

**Payload `/admin` stays separate.** A Starforge `admin` role does **not** yet open CMS editor access — the global-admin → Payload bridge is a documented follow-up. Do not move product users into Payload collections.

## Tables (`public`)

- `sf_users` — app user profile (email is the login id; `role`, `banned`, `ban_reason`, `ban_expires`)
- `sf_sessions` — cookie sessions (+ `impersonated_by` for Better Auth admin plugin)
- `sf_accounts` — auth providers (email/password hash lives here on the `credential` provider)
- `sf_verifications` — one-time tokens (unused until email flows land)

**After pulling role/admin changes, always run** `npm run db:core:push` (Compose up, `.env` loaded) so Postgres gains `sf_sessions.impersonated_by` and the `sf_users` role/ban columns. Without that push, `/app/admin/users` fails with `column "impersonated_by" does not exist`.

## Roles

| Role | Meaning |
| --- | --- |
| `admin` | Global **app** admin — `/app/admin/users`, `/app/admin/settings`, list users, set roles, disable |
| `member` | Default product user (Better Auth `defaultRole`) |

Implemented with the Better Auth **admin** plugin + custom access control (`src/core/auth/permissions.ts`).

### Bootstrap an admin

1. **Seed:** `npm run seed` creates `admin@starforge.local` / `starforge-admin` with role `admin` (plus a demo `member`). Use that pair on `/login` for core admin — not Payload `/admin`.
2. **Env promote (existing account):** set `STARFORGE_ADMIN_EMAILS=you@example.com` (comma-separated) in `.env`, **restart** `npm run dev`, then reload (or visit `/app/admin/users`). Matching signed-in users are promoted to `admin` on that request (also on signup and seed).

Members visiting `/app/admin/users` are redirected to `/?notice=admins-only` — expected, not a bug.

## Local forms

Register / login / logout use **Next.js server actions** so session cookies are set via the `nextCookies` plugin (same-origin, works on both `localhost` and `127.0.0.1`). Prefer one host consistently (README recommends `http://localhost:3000`).

Register auto-signs-in and redirects to `/`. If a session cookie is missing after signup, the action signs in once with the same credentials before redirecting (or shows an error pointing at `/login`).

Registration respects the **Registration** feature toggle (`site-settings`): when off, `/register` is hidden/blocked and `registerAction` rejects signups.

Login errors distinguish: unknown email, account without a password hash (pre-fix debris), and wrong password. Always sign in with **email**, never display name. Disabled (`banned`) users cannot sign in.

## Deferred

- **Forgot / reset password** — needs outbound email; deferred until email is wired (P1+).
- **Global admin → Payload CMS bridge** — one admin should eventually reach content `/admin` without a second account; not in this slice.

## Env

- `BETTER_AUTH_SECRET` — long random string (required)
- `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL` — `http://localhost:3000` locally
- `STARFORGE_ADMIN_EMAILS` — optional comma-separated emails auto-promoted to `admin`
