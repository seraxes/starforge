---
kind: reference
last_verified: 2026-11-28
---
# Backup and restore

Sources: `.env.example`, `src/core/media/storage/local.ts`, `src/core/media/storage/types.ts`, `src/core/db/schema.ts`, module schemas under `src/modules/*/schema.ts`.

## What the app stores

| Store | Location | Notes |
| --- | --- | --- |
| Database | Postgres via `DATABASE_URL` | Core `sf_*` tables (auth, sessions, site settings, …) plus pack tables (`sf_profiles`, `sf_events`, `sf_media_assets`, `sf_email_sends`, `sf_redirects`, payments, …). |
| Media — local disk (default) | Repo `/media` (Payload-era `staticDir`); files under `/media/<category-slug>/` | Selected when `STARFORGE_MEDIA_STORAGE` is unset or `local`. |
| Media — object storage | S3-compatible bucket from `S3_BUCKET` (+ `S3_ENDPOINT`, keys, optional `S3_PUBLIC_BASE_URL`) | When `STARFORGE_MEDIA_STORAGE=s3`. Incomplete s3 env refuses boot — no silent local fallback. |
| Media metadata | Postgres `sf_media_assets` (and related media tables) | Document store; binary bytes follow the active MediaStorage adapter. |
| Content cache / rate-limit / BA secondary (optional) | Redis when `REDIS_URL` (+ optional `STARFORGE_CONTENT_CACHE=redis`) | Sessions stay in Postgres and may be mirrored to Redis. |
| Env secrets | Process env / gitignored `.env.local` | Not in Postgres. Merchant gateway secrets: encrypted `sf_pay_merchant_credentials`. |

## Schedule

TODO(owner): backup schedule (database and media).

## Bucket / offsite target

TODO(owner): production backup bucket or offsite target name. `S3_BUCKET` is the live media bucket when s3 storage is on — not automatically a backup destination.

## Last restore drill

**2026-11-28 — pass (local).** Dump of live `starforge` into scratch `starforge_restore_drill` on the local Postgres 16 container (`pg_dump` / `psql` via `docker exec`). Restored **134** `public.sf_*` tables and the `sf_site_settings` row. Booted `npm run start -p 3019` with `DATABASE_URL` pointed at the scratch DB; `GET /api/health` returned `{"ok":true,"database":"up"}`. Scratch DB dropped after the drill. Production backup schedule and offsite target still open above.
