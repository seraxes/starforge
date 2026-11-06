---
cursor:
  subagentId: "bc-0ab719b5-2646-52f8-8a6c-6069013cc077"
---

# Starforge design — data and deploy-ready Core

**Status:** target design. Today there are no migrations (Drizzle `push` only; Payload pushes in dev only), no CI, and no boot env validation. Local-first stays; this is what must be true before SF-6 hosting. Overview: [design-system-overview](./design-system-overview.md). Security items referenced: [design-security](./design-security.md).

## 1. Topology (DigitalOcean, per preferences)

| Node | Runs | Network |
| --- | --- | --- |
| **Web droplet** | nginx (TLS, `client_max_body_size`, sets `X-Real-IP`) → `next start` (1+ instances) | Public 443 |
| **DB droplet** | Postgres 16 | **Private VPC only**; firewall denies public 5432 |
| **Redis** | DO Managed Redis or local on web droplet | Private; `rediss://` when managed |
| **Spaces** | Media bucket + CDN | Public CDN for `visibility=public` only |

Local: Docker Compose Postgres. **Change `ports: '5432:5432'` → `'127.0.0.1:5432:5432'`** to match the "DB never public" rule on LAN machines. Add an optional `redis` service under a Compose profile so the Redis path can be tested locally.

## 2. Database migrations

Two schema owners, never crossed: **Drizzle → `public.sf_*`**, **Payload → `payload`**.

### Baseline (one-time)

1. `drizzle-kit generate --name baseline` → `src/core/db/migrations/0000_baseline.sql` (the `out` dir is already configured).
2. `payload migrate:create baseline` → `src/migrations/`; set `postgresAdapter({ migrationDir, push: false })` explicitly (dev push remains optional via env).
3. Existing dev DBs (created by `push`): either reset (`docker compose down -v`), or mark the baseline applied by inserting its hash into `drizzle.__drizzle_migrations` (`payload migrate` handles its own table). Document both in the README.

### Scripts

| Script | Use |
| --- | --- |
| `db:core:generate` | New migration from schema diff (every schema PR) |
| `db:core:migrate` | Apply Core migrations (CI, deploy) |
| `db:core:push` | **Local scratch only.** Never prod |
| `payload:migrate` / `payload:migrate:create` | Payload schema |
| `db:migrate` | `db:core:migrate && payload:migrate` |

### Rules

- Every PR touching `src/core/db/schema.ts`, module `schema.ts`, or Payload collections ships its migration. CI fails on drift (`drizzle-kit generate` produces a new file → fail).
- Module tables: prefix `sf_<module>_*`. Drizzle config `schema` becomes a glob array including `src/modules/*/schema.ts` ([design-module-boundary](./design-module-boundary.md)).
- Destructive changes take two steps: add + backfill, then drop in a later release.
- **JSON columns:** document blobs edited as a whole (`sf_layouts`, `sf_page_chrome`, `sf_nav_menus`, `sf_forms`) may stay `text` JSON. Anything **queried** must be `jsonb`. First case: `sf_form_submissions.payload` → `jsonb`, plus `definition_version int`, `fields_snapshot jsonb` (or `definition_hash`), `user_id text null`, and typed values (arrays for checkbox-group/multi-file). Do this **before** SF-133 CSV export and event registration.
- Runtime `ensure*Seeded()` stays idempotent. `npm run seed` is dev/demo only.

## 3. Environment contract

**Boot validation:** `src/instrumentation.ts` → `core/env/validate.ts`. In `production` it throws on errors; in dev it warns.

| Group | Keys | Prod rule |
| --- | --- | --- |
| Core (required) | `DATABASE_URL`, `PAYLOAD_SECRET`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL` | Non-empty; secrets ≥ 32 chars; URL `https://` unless `STARFORGE_SECURE_COOKIES=0` |
| Cookies / origins | `STARFORGE_SECURE_COOKIES`, `STARFORGE_TRUSTED_ORIGINS` (new), `STARFORGE_TRUSTED_PROXY_HOPS` (new) | Optional |
| Admin | `STARFORGE_ADMIN_EMAILS`, `STARFORGE_DEVELOPER_ADMIN_EMAILS`, `STARFORGE_ENV_EDITOR`, `STARFORGE_ADMIN_THEME` | Warn if developer list empty (→ nobody) |
| Cache / Redis | `STARFORGE_CONTENT_CACHE`, `REDIS_URL`, `STARFORGE_REDIS_PREFIX` (new) | `redis` selected ⇒ `REDIS_URL` required; multi-instance ⇒ Redis required |
| Media | `STARFORGE_MEDIA_STORAGE`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL`, `S3_FORCE_PATH_STYLE`, `S3_ACL` | `s3` selected ⇒ all required. **Throw** instead of today's silent local-disk fallback |
| Mail | `STARFORGE_MAIL_FROM`, `SMTP_*`, `RESEND_API_KEY` | Provider chosen in Chrome ⇒ its keys required (warn) |
| Captcha | `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Turnstile enabled ⇒ both |
| Modules | `SF_MODULES` (build) | Build-time only |

The Environment editor catalog and `.env.example` are generated from (or tested against) this one table. Modules contribute their keys via the manifest `env` field.

## 4. Redis (one client, several uses)

| Use | Keys | State |
| --- | --- | --- |
| Published-content cache | `{prefix}:pcc:v:*`, `{prefix}:pcc:t:*` | Shipped (#76) |
| Rate limiter | `{prefix}:rl:*` (`INCR` + `EXPIRE`) | Planned (design-security §6) |
| Better Auth secondary storage / rate limit | `{prefix}:ba:*` | Planned |
| Queues (BullMQ) | `{prefix}:q:*` | When the first async job exists (mail retry, video, webhooks) |

Fixes to the shipped cache:
1. `STARFORGE_REDIS_PREFIX` (default `sf:${NODE_ENV}`) on every key, so staging and prod can share one Redis safely.
2. Cache misses (`null`) get a short TTL (e.g. 60 s). Today every probed random slug creates a permanent key.
3. Tag sets get `EXPIRE` ≥ the longest member TTL; prune members on invalidate.
4. `invalidateTags` returns a `Promise`. Server actions and Payload hooks `await` it, so save → redirect never reads stale data on another instance.
5. Extend the cache to the layout doc, Page Settings chrome, nav menus, and the proxy policy doc (redirects + offline + CSP sources). This removes the two internal `fetch` hops the middleware makes on every public request today.

## 5. Spaces / S3

- Payload `@payloadcms/storage-s3` (shipped #77). Keep it; don't hand-roll I/O.
- Private uploads (Form attachments) follow [design-security](./design-security.md) §3: private ACL, access-checked or signed downloads.
- Bucket: versioning on; lifecycle rule to expire orphaned `forms/` objects older than N days that have no Media row (belt-and-braces with pipeline cleanup).
- Backups: Spaces versioning, plus nightly `pg_dump` of both schemas from the DB droplet to a separate private bucket.

## 6. CI (GitHub Actions)

| Job | Steps |
| --- | --- |
| **check** | `npm ci` → `modules:generate` (fail if the generated file changed) → `tsc --noEmit` → `eslint` |
| **unit** | `tsx --test` (no new deps) on pure engines: `forms/{expr,logic,evaluate,date-constraints}`, `modules/{grid,document,empty-rows}`, `redirects/paths`, `security/secure-cookies`, `env/validate` |
| **migrate** | Services: postgres:16, redis:7 → `db:migrate` on an empty DB → `drizzle-kit generate` drift check |
| **smoke** | `next build` → `next start` → curl: `/api/health` 200, `/` 200, `/login` 200, `/sitemap.xml` 200, `/robots.txt` 200, `/admin` → 302 `/login`, security headers present; run existing `verify:*` scripts |
| **flavor** | Minimal build `SF_MODULES=platform:better-auth,page-content,product:layout-manager` must compile (deadweight / boundary check) |

Branch protection: merge only on green. This is the main guard against regressions in agent-merged PRs.

## 7. Deploy runbook (target)

```
1  pg_dump (both schemas) → private bucket
2  git pull && npm ci && npm run modules:generate
3  npm run db:migrate            # core then payload
4  npm run build
5  restart next instances (systemd/pm2), one at a time
6  smoke: /api/health (DB + Redis + storage info), /, /login, /admin → /login
7  rollback: previous build dir + migrations are forward-only (restore dump if needed)
```

`/api/health` should report DB reachability, Redis ping (when selected), `MediaStorage.info().ready`, and the migration version. No secrets in output.

## Deploy-ready checklist

- [ ] Baseline migrations (Drizzle + Payload), `push: false`
- [ ] CI jobs above + branch protection
- [ ] Boot env validation (S3/Redis/secret/URL rules)
- [ ] Redis prefix, miss TTL, awaited invalidation
- [ ] Proxy in-process policy doc (no internal fetch hops)
- [ ] Compose Postgres bound to 127.0.0.1; DB droplet firewall
- [ ] Security "Now" items from [design-security](./design-security.md)
- [ ] Submissions `jsonb` + version/snapshot/user_id migration
