# Starforge core — auth

Product auth / sessions for **app users** (Better Auth + Drizzle + Postgres `public`).

| Concern | Where |
| --- | --- |
| App register / login / logout / session | This module · `/login` · `/register` · `/api/auth/*` · `/api/me` |
| App roles + user admin | `sf_users.role` · `/app/admin/users` (admins only) |
| CMS editors (content only) | Payload `users` collection · `/admin` |

Do **not** route high-QPS app login/session traffic through Payload Local API. Payload users and Starforge app users are separate accounts in separate tables/schemas.

**Payload `/admin` stays separate.** A Starforge `admin` role does **not** yet open CMS editor access — the global-admin → Payload bridge is a documented follow-up. Do not move product users into Payload collections.

## Tables (`public`)

- `sf_users` — app user profile (email is the login id; `role`, `banned`, …)
- `sf_sessions` — cookie sessions (+ optional `impersonated_by`)
- `sf_accounts` — auth providers (email/password hash lives here on the `credential` provider)
- `sf_verifications` — one-time tokens (unused until email flows land)

Push with `npm run db:core:push` after Compose is up.

## Roles

| Role | Meaning |
| --- | --- |
| `admin` | Global **app** admin — can open `/app/admin/users`, list users, set roles, disable |
| `member` | Default product user (Better Auth `defaultRole`) |

Implemented with the Better Auth **admin** plugin + custom access control (`src/core/auth/permissions.ts`).

### Bootstrap an admin

1. **Seed:** `npm run seed` creates `admin@starforge.local` / `starforge-admin` with role `admin` (plus a demo `member`).
2. **Env promote:** set `STARFORGE_ADMIN_EMAILS=you@example.com` (comma-separated). Matching emails are promoted on signup and again by seed. Register that email (or seed first, then set env and re-seed) to get admin.

## Local forms

Register / login / logout use **Next.js server actions** so session cookies are set via the `nextCookies` plugin (same-origin, works on both `localhost` and `127.0.0.1`). Prefer one host consistently (README recommends `http://localhost:3000`).

Register auto-signs-in and redirects to `/`. If a session cookie is missing after signup, the action signs in once with the same credentials before redirecting (or shows an error pointing at `/login`).

Login errors distinguish: unknown email, account without a password hash (pre-fix debris), and wrong password. Always sign in with **email**, never display name. Disabled (`banned`) users cannot sign in.

## Deferred

- **Forgot / reset password** — needs outbound email; deferred until email is wired (P1+).
- **Global admin → Payload CMS bridge** — one admin should eventually reach content `/admin` without a second account; not in this slice.

## Env

- `BETTER_AUTH_SECRET` — long random string (required)
- `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL` — `http://localhost:3000` locally
- `STARFORGE_ADMIN_EMAILS` — optional comma-separated emails auto-promoted to `admin`
