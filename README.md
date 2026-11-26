# Starforge

Reusable product core for ordinary web apps: auth, users/groups, app shell, and toggleable packs. The content manager is **`product:pages`**. Media is **`product:media`**. Sign-in is Better Auth only; one admin at `/admin`.

Live architecture and open work: [architecture-current](docs/project-context/docs/architecture-current.md). Agent index: [AGENTS.md](AGENTS.md).

## Placements

| Placement | What it is |
| --- | --- |
| **Core** | Host that boots every site (auth, layout/nav/chrome, module installer, thin ports) |
| **Base module** | Shared engine other packs list in `requires` (Media, Forms, Payments, …) |
| **Advanced module** | Domain product that depends on base packs (Events, Subscriptions, Social, …) |
| **Hero** | One site’s brand and vertical rules — does not fork a module |

Details: [platform-module-layers](docs/project-context/docs/platform-module-layers.md).

## Requirements

- **Node.js** `^22.23.4` or `>=24.22.1` (`package.json` `engines`)
- **Postgres 16** (Compose image `postgres:16-alpine` in `docker-compose.yml`)
- Docker Desktop (or Engine + Compose) for local Postgres
- Git

## Quickstart

```bash
git clone <repo-url>
cd starforge
docker compose up -d
cp .env.example .env
npm install
npm run db:migrate
npm run seed          # local development database only — never production
npm run dev
```

Open **http://localhost:3000** (prefer `localhost` over `127.0.0.1` for cookies).

After `npm run seed` on a **local** database, you can sign in as `admin@starforge.local` / `starforge-admin`. That account is for a development database only. `npm run seed` refuses `NODE_ENV=production` unless `STARFORGE_ALLOW_PRODUCTION_SEED=1` (demo override — not normal production). Never reuse seed credentials on a deployed site.

Longer first-time steps (Windows volume reset, env notes): [docs/dev/local-setup.md](docs/dev/local-setup.md).

## Important scripts

| Script | Purpose |
| --- | --- |
| `npm run db:migrate` | Apply Core Drizzle (`sf_*`) migrations |
| `npm run seed` | Local demo data (blocked in production without override) |
| `npm run dev` | Next.js development server |
| `npm run build` / `npm run start` | Production build and serve |
| `npm run lint` | ESLint |
| `npm run test:unit` | Registered unit tests |
| `npm run test:e2e` | Playwright page smoke (app running; seed for auth) |
| `npm run check:atomic` | Module boundary verify |
| `npm run check:docs` | Docs frontmatter / links / rules hygiene |
| `npm run modules:generate` | Regenerate module registry (`predev` / `prebuild`) |

More commands and admin URLs: [docs/dev/admin-tour.md](docs/dev/admin-tour.md). Ops deploy / env: [docs/ops/](docs/ops/).

## Production warning

- Do **not** run `npm run seed` against production.
- Replace every `dev-only` / `change-me` secret before shared use. Production boot rejects placeholders and requires `SF_PAY_CREDENTIALS_KEY`. See [production-env-checklist](docs/ops/production-env-checklist.md).
- Use `https://` app URLs (or deliberate `STARFORGE_SECURE_COOKIES=0`). Prefer file-based env over a writable Environment UI in production.
- Deploy / backup / cutover: [docs/ops/deploy.md](docs/ops/deploy.md).

## Docs map

| Need | Doc |
| --- | --- |
| Live map | [architecture-current](docs/project-context/docs/architecture-current.md) |
| Agent entry | [AGENTS.md](AGENTS.md) |
| Local setup | [docs/dev/local-setup.md](docs/dev/local-setup.md) |
| Admin tour | [docs/dev/admin-tour.md](docs/dev/admin-tour.md) |
| Troubleshooting | [docs/dev/troubleshooting.md](docs/dev/troubleshooting.md) |
| Ops / launch | [docs/ops/](docs/ops/) |
