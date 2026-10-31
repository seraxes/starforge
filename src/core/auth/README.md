# Starforge core — auth

Product auth / sessions for **app users** (Better Auth + Drizzle + Postgres `public`).

| Concern | Where |
| --- | --- |
| App register / login / logout / session | This module · `/login` · `/register` · `/api/auth/*` · `/api/me` |
| App roles + user admin | `sf_users.role` · `/app/admin/users` (admins only) |
| Global admin → CMS bridge | `src/core/cms-bridge` · seed · `/app/admin/cms` → Payload `/admin` |
| CMS editors (content only) | Payload `users` collection · `/admin` |

Do **not** route high-QPS app login/session traffic through Payload Local API. Payload users and Starforge app users are separate accounts in separate tables/schemas.

**Linked accounts for global admins:** seed (and `/app/admin/cms`) create a Payload editor with the **same email** so one platform admin can reach content. Sessions stay separate (core cookie ≠ Payload cookie). Product **members are never** copied into Payload.

## Tables (`public`)

- `sf_users` — app user profile (email is the login id; `role`, `banned`, `ban_reason`, `ban_expires`)
- `sf_sessions` — cookie sessions (+ `impersonated_by` for Better Auth admin plugin)
- `sf_accounts` — auth providers (email/password hash lives here on the `credential` provider)
- `sf_verifications` — one-time tokens (unused until email flows land)

**After pulling role/admin changes, always run** `npm run db:core:push` (Compose up, `.env` loaded) so Postgres gains `sf_sessions.impersonated_by` and the `sf_users` role/ban columns. Without that push, `/app/admin/users` fails with `column "impersonated_by" does not exist`.

## Roles

| Role | Meaning |
| --- | --- |
| `admin` | Global **app** admin — `/app/admin/*` **and** linked Payload `/admin` CMS editor |
| `member` | Default product user (Better Auth `defaultRole`) |

Implemented with the Better Auth **admin** plugin + custom access control (`src/core/auth/permissions.ts`).

### Bootstrap an admin

1. **Seed:** `npm run seed` creates `admin@starforge.local` / `starforge-admin` with role `admin` **and** a linked Payload CMS editor with the **same** email/password. Use that pair on `/login` for core admin and on `/admin` for CMS.
2. **Env promote (existing account):** set `STARFORGE_ADMIN_EMAILS=you@example.com` (comma-separated) in `.env`, **restart** `npm run dev`, then reload (or visit `/app/admin/users`). Matching signed-in users are promoted to `admin` on that request (also on signup and seed). Seed (and **CMS access → Ensure**) also create a Payload editor for those emails using `STARFORGE_CMS_BRIDGE_PASSWORD` (default `starforge-admin`).

Members visiting `/app/admin/users` are redirected to `/?notice=admins-only` — expected, not a bug.

### Reach Payload `/admin` as a global admin

1. Run `npm run seed` (or open `/app/admin/cms` and click **Ensure my CMS editor account**).
2. Open `/admin` and sign in with the linked email + CMS bridge password.
3. Core `/app/admin` nav includes **CMS access** and **Open Payload CMS**.

Shared session SSO into Payload is **not** wired — linked accounts keep Payload swappable as a content module.

## Local forms

Register / login / logout use **Next.js server actions** so session cookies are set via the `nextCookies` plugin (same-origin, works on both `localhost` and `127.0.0.1`). Prefer one host consistently (README recommends `http://localhost:3000`).

Register auto-signs-in and redirects to `/`. If a session cookie is missing after signup, the action signs in once with the same credentials before redirecting (or shows an error pointing at `/login`).

Login errors distinguish: unknown email, account without a password hash (pre-fix debris), and wrong password. Always sign in with **email**, never display name. Disabled (`banned`) users cannot sign in.

## Deferred

- **Forgot / reset password** — needs outbound email; deferred until email is wired (P1+).
- **Single sign-on into Payload** — optional later; linked-account bridge is the durable path for now.

## Env

- `BETTER_AUTH_SECRET` — long random string (required)
- `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL` — `http://localhost:3000` locally
- `STARFORGE_ADMIN_EMAILS` — optional comma-separated emails auto-promoted to `admin` (+ CMS bridge on seed)
- `STARFORGE_CMS_BRIDGE_PASSWORD` — optional password for auto-provisioned Payload editors (default `starforge-admin`)
