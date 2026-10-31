# Starforge core — auth

Product auth / sessions for **app users** (Better Auth + Drizzle + Postgres `public`).

| Concern | Where |
| --- | --- |
| App register / login / logout / session | This module · `/login` · `/register` · `/api/auth/*` · `/api/me` |
| App roles + user admin | `sf_users.role` · `/app/admin/users` (admins only) |
| CMS access toggle | `sf_users.cms_access` · Users table switch · provisions Payload stub |
| Payload `/admin` auth | Better Auth cookie via `starforgeCoreSessionStrategy` (one login) |

Do **not** route high-QPS app login/session traffic through Payload Local API. Payload user rows are **CMS stubs** linked by `coreUserId` — not the product user store. Ordinary members are never bulk-synced into Payload.

**One login only.** Sign in at `/login`. With `cms_access`, open `/admin` already authenticated — no Payload email/password form.

## Tables (`public`)

- `sf_users` — app user profile (`role`, `cms_access`, `banned`, …)
- `sf_sessions` — cookie sessions (+ `impersonated_by` for Better Auth admin plugin)
- `sf_accounts` — auth providers (email/password hash lives here on the `credential` provider)
- `sf_verifications` — one-time tokens (unused until email flows land)

**After pulling this branch, always run** `npm run db:core:push` so Postgres gains `sf_users.cms_access` (and any earlier admin columns). Without that push, admin pages fail on missing columns.

## Roles + CMS access

| Flag / role | Meaning |
| --- | --- |
| `admin` | Global app admin — `/app/admin/*`; **cms_access on by default** |
| `member` | Default product user |
| `cms_access` | May open Payload `/admin` via the Better Auth session (toggle on Users) |

### Bootstrap an admin

1. **Seed:** `npm run seed` creates `admin@starforge.local` / `starforge-admin` with role `admin` + `cms_access`, and a Payload stub. Sign in once at `/login`, then open `/admin` — no second password.
2. **Env promote:** set `STARFORGE_ADMIN_EMAILS=you@example.com`, restart `npm run dev`, reload while signed in — promoted to admin + CMS access.

Members visiting `/app/admin/users` are redirected to `/?notice=admins-only`. Users without `cms_access` who open `/admin` go to `/?notice=cms-denied`.

### Reach Payload `/admin`

1. Sign in at `/login` (seed admin or any user with CMS access on).
2. Open `/admin` (or `/admin/login`) — middleware sends you through `/api/cms/exchange`, which sets a Payload `payload-token` JWT, then the dashboard loads (**no** Payload password form; `/admin/login` never renders).
3. Manage the per-user switch under `/app/admin/users` (CMS access column).

Unauthenticated `/admin` → core `/login?next=/admin` → after login, exchange → CMS.

## Local forms

Register / login / logout use **Next.js server actions** so session cookies are set via the `nextCookies` plugin. Prefer `http://localhost:3000`.

## Deferred

- **Forgot / reset password** — needs outbound email.
- Optional later: richer Payload logout → core sign-out button (core `/login` session still rules).

## Env

- `BETTER_AUTH_SECRET` — long random string (required)
- `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL` — `http://localhost:3000` locally
- `STARFORGE_ADMIN_EMAILS` — optional comma-separated emails auto-promoted to `admin` + CMS access
