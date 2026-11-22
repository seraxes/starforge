---
kind: reference
last_verified: 2026-11-22
---
# Local setup

Moved from the root README (slice D6). First-time and day-to-day local database setup. Newbie-oriented steps also live in [local-setup-guide](../project-context/docs/local-setup-guide.md).

## Requirements

- Node.js `^22.23.4` or `>=24.22.1`
- Postgres 16 via Docker (`postgres:16-alpine` in `docker-compose.yml`)
- Optional Redis: `docker compose --profile redis up -d`

## First-time

```bash
git clone <repo-url>
cd starforge
docker compose up -d
cp .env.example .env
npm install
npm run db:migrate
npm run seed
npm run dev
```

Open **http://localhost:3000** (prefer `localhost`, not `127.0.0.1`, so cookies and CSRF stay consistent).

### Seed account (development only)

`npm run seed` creates `admin@starforge.local` / `starforge-admin` (and a demo member). Use only on a **local development database**. Never run seed against production or reuse these credentials on a deployed site. Production refuses seed unless `STARFORGE_ALLOW_PRODUCTION_SEED=1`.

Alternatively set `STARFORGE_ADMIN_EMAILS=you@example.com` in `.env`, restart `npm run dev`, and reload while signed in to promote that email.

## Database migrations

| Script | Use |
| --- | --- |
| `db:migrate` | Apply Core Drizzle migrations (`sf_*`). Prefer this after pull / volume reset. |
| `db:core:generate` | New Core migration from schema diff |
| `db:core:migrate` | drizzle-kit migrate only |
| `db:core:push` | **Local scratch only** — never prod / shared DBs |

**Always use `npm run db:migrate`** after pull or a volume reset.

### Local volume reset (Windows)

Docker Desktop must be **Running**. From the repo root:

**CMD:**

```bat
cd %USERPROFILE%\starforge
git pull
docker compose down -v
docker compose up -d
npm run db:migrate
npm run seed
npm run dev
```

**PowerShell:**

```powershell
cd $env:USERPROFILE\starforge
git pull
docker compose down -v
docker compose up -d
npm run db:migrate
npm run seed
npm run dev
```

## Environment

Copy `.env.example` → `.env`. Minimum local keys:

```env
DATABASE_URL=postgresql://starforge:starforge@127.0.0.1:5432/starforge
PAYLOAD_SECRET=dev-only-change-me-to-a-long-random-string
BETTER_AUTH_SECRET=dev-only-better-auth-secret-change-me
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Change secrets before any shared use. Production rejects placeholders and requires additional keys — see [production-env-checklist](../ops/production-env-checklist.md).

Optional local Redis content cache: `STARFORGE_CONTENT_CACHE=redis` + `REDIS_URL`. Media defaults to local disk under `/media`; S3 needs `STARFORGE_MEDIA_STORAGE=s3` and the required `S3_*` keys.

## Useful docker commands

```bash
docker compose ps
docker compose logs -f postgres
docker compose down          # stop DB (named volume kept)
docker compose down -v       # destroy volume — then migrate + seed again
```
