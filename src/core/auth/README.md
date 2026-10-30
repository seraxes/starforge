# Starforge core — auth

Product auth / sessions for **app users** (Better Auth + Drizzle + Postgres `public`).

| Concern | Where |
| --- | --- |
| App register / login / logout / session | This module · `/login` · `/register` · `/api/auth/*` · `/api/me` |
| CMS editors (content only) | Payload `users` collection · `/admin` |

Do **not** route high-QPS app login/session traffic through Payload Local API. Payload users and Starforge app users are separate accounts in separate tables/schemas.

## Tables (`public`)

- `sf_users` — app user profile
- `sf_sessions` — cookie sessions
- `sf_accounts` — auth providers (email/password hash lives here)
- `sf_verifications` — one-time tokens (unused until email flows land)

Push with `npm run db:core:push` after Compose is up.

## Env

- `BETTER_AUTH_SECRET` — long random string (required)
- `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL` — `http://localhost:3000` locally
