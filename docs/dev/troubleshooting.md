---
kind: reference
last_verified: 2026-11-22
---
# Troubleshooting

Moved from the root README (slice D6). Local development fixes.

1. **Docker not running** — start Docker Desktop; `docker compose ps` should show `starforge-postgres` healthy.
2. **Port 5432 or 3000 in use** — stop the other process, or change the host port in `docker-compose.yml` / Next (`npm run dev -- -p 3001`).
3. **Fresh DB / empty volume** — Compose mounts `docker/postgres/init.sql` only on first volume create. Recreate with `docker compose down -v && docker compose up -d`, then `npm run db:migrate` and `npm run seed`.
4. **Auth tables missing / `Failed query` on `sf_sessions`** — Core tables live in `public` and come from Drizzle. Run **`npm run db:migrate`**. After a volume reset, use the Windows sequences in [local-setup](./local-setup.md). Scratch-only fallback: `npm run db:core:push` (never on shared/prod).
5. **`column "impersonated_by" does not exist` (or missing `role` / `banned` / `two_factor_enabled` on `sf_users`, or missing `sf_two_factors`)** — schema is ahead of your Postgres. Prefer `docker compose down -v` then `npm run db:migrate`, or `db:core:push` on scratch only; restart `npm run dev`.
6. **`sf_site_settings` missing / site settings save fails** — run `npm run db:migrate`. Opening `/admin` does not invent the table. If still missing: volume-reset, migrate, seed.
7. **Seed fails on demo app user** — ensure `npm run db:migrate` succeeded first.
8. **Windows** — use PowerShell or CMD from the repo root; Docker Desktop must be **Running**. Copy env with `copy .env.example .env` if `cp` is unavailable. Always open **http://localhost:3000** (mixing `127.0.0.1` can break sessions).
9. **Login says invalid email/password after register** — restart `npm run dev`; register a new email (or use the local seed demo); sign in with that **email**. Last resort: volume reset + migrate + seed.
10. **Members cannot open `/admin`** — need app `admin` role or a group ACL grant for that area. Seed admin has full access locally.
11. **Draft preview 404** — enable **Draft preview** under `/admin/settings`, stay signed in with `cms_access`, open `/preview/{slug}` for an unpublished draft. Anonymous `/[slug]` stays published-only.
12. **Media storage not ready** — incomplete `STARFORGE_MEDIA_STORAGE=s3` without all required `S3_*` keys fails at boot. Unset for local disk, or set every required key. See [production-env-checklist](../ops/production-env-checklist.md).
13. **Env / Secure cookies** — local HTTP: leave `STARFORGE_SECURE_COOKIES` unset or `0`. Production HTTPS: use `https://` app URLs. Boot warnings appear as `[starforge:env] …` in the server log.
14. **Health check** — `GET /api/health` must return `"ok":true` and `"database":"up"` when Postgres is reachable.
