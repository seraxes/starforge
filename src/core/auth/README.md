# Starforge core — auth

Product auth / sessions for **app users** (Better Auth + Drizzle + Postgres `public`).

| Concern | Where |
| --- | --- |
| App register / login / logout / session | This module · `/login` · `/register` · `/api/auth/*` · `/api/me` |
| CMS editors (content only) | Payload `users` collection · `/admin` |

**Clarity:** `/admin` is for **content** (pages, media, CMS editors). Core `/login` is for **app accounts**. They never share credentials.

Do **not** route high-QPS app login/session traffic through Payload Local API. Payload users and Starforge app users are separate accounts in separate tables/schemas.

## Tables (`public`)

- `sf_users` — app user profile (email is the login id; there is no separate username)
- `sf_sessions` — cookie sessions
- `sf_accounts` — auth providers (email/password hash lives here on the `credential` provider)
- `sf_verifications` — one-time tokens (unused until email flows land)

Push with `npm run db:core:push` after Compose is up.

## Local forms

Register / login / logout use **Next.js server actions** so session cookies are set via the `nextCookies` plugin (same-origin, works on both `localhost` and `127.0.0.1`). Prefer one host consistently (README recommends `http://localhost:3000`).

Register auto-signs-in and redirects to `/`. If a session cookie is missing after signup, the action signs in once with the same credentials before redirecting (or shows an error pointing at `/login`).

Login errors distinguish: unknown email, account without a password hash (pre-fix debris), and wrong password. Always sign in with **email**, never display name.

## Deferred

- **Forgot / reset password** — needs outbound email; deferred until email is wired (P1+).


## Env

- `BETTER_AUTH_SECRET` — long random string (required)
- `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL` — `http://localhost:3000` locally
