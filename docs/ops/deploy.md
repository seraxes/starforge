---
kind: reference
last_verified: 2026-11-27
---
# Deploy

Sources: `package.json` scripts, `.github/workflows/ci.yml`, `src/app/api/health/route.ts`.

Node engines from `package.json`: `^22.23.4 || >=24.22.1`. CI uses Node 22.

## Commands the repo defines

| Step | Command | Notes |
| --- | --- | --- |
| Install dependencies | `npm ci` | Used by CI. Not a `package.json` `scripts` entry — npm built-in. |
| Apply DB migrations | `npm run db:migrate` | Runs `tsx scripts/db-migrate.mts` (Core Drizzle migrate + related verify/copy steps in that script). CI also creates `payload` schema first when needed. |
| Build | `npm run build` | `prebuild` runs `npm run modules:generate`. |
| Start | `npm run start` | `next start` via the package script. |
| Seed (optional / CI smoke) | `npm run seed` | Refused when `NODE_ENV=production` unless `STARFORGE_ALLOW_PRODUCTION_SEED=1` — see [production-env-checklist](./production-env-checklist.md). |

Related scripts that exist but are not the primary deploy path: `db:core:migrate` (drizzle-kit only), `db:core:generate`, `db:core:push`, `modules:generate`, `modules:sync`.

## Health check

`GET /api/health` (`src/app/api/health/route.ts`).

- Success `200`: `{ "ok": true, "service": "starforge-core", "database": "up", "timestamp": "…" }`
- Failure `503`: `{ "ok": false, "service": "starforge-core", "database": "down", "error": "…", "timestamp": "…" }`

CI smoke starts the server with `npm run start`, then curls `http://127.0.0.1:3000/api/health` and requires `"ok":true`. After curl checks pass, the same job runs Playwright page smoke (`npm run test:e2e`) against Chromium (home, login, admin gate, authenticated Dashboard, social feed) and fails on page/console errors. Locally: start the app (seeded for auth routes), then `npm run test:e2e` or `npm run test:e2e:ui`.

## Host / process manager

TODO(owner): production host, reverse proxy, and process manager. The repo does not name a production host or PM.

## Rollback

TODO(owner): rollback procedure. There is no `rollback` (or equivalent) script in `package.json`. Do not invent a rollback command.
