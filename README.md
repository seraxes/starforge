# Starforge

Reusable **product core** for ordinary web apps (auth, users, app shell, extension points) with **Payload CMS 3** as a swappable **content/media module** — not the whole product.

This is an early scaffold plus **core app auth** (Better Auth), **roles + core user admin**, **one-login Payload CMS access** (`cms_access` toggle), **site settings + feature toggles**, **Lexical** page editing, **public `/[slug]`** rendering, **page SEO fields**, and **`npm run seed`**. It is intentionally small and runnable locally — not Airsoftnexus 2.0 feature parity, and not a DigitalOcean deploy.

## Architecture

| Layer | Owns | Location |
| --- | --- | --- |
| **Starforge core** | Product APIs, auth/sessions/users, Drizzle tables in Postgres `public` | `src/core/`, `src/app/api/` |
| **Payload content module** | Collections, globals (site settings), drafts, media, CMS admin | `src/collections/`, `src/globals/`, `src/payload.config.ts`, `src/app/(payload)/` |

- Payload tables use Postgres schema **`payload`** (created by `docker/postgres/init.sql`).
- Core auth tables: `sf_users`, `sf_sessions`, `sf_accounts`, `sf_verifications` (push with `npm run db:core:push`).
- Hot paths stay in core — do not put high-QPS app traffic through Payload Local API.

### App users vs Payload CMS stubs (one login)

| | Starforge app account | Payload CMS stub |
| --- | --- | --- |
| Purpose | Product login (membership, gated app features) | Content editor identity inside Payload |
| UI | `/register`, `/login`; admins also `/app/admin/*` | **`/admin`** (opens with the **same** Better Auth session when `cms_access` is on) |
| API | Better Auth `/api/auth/*`, `GET /api/me` | Payload REST/GraphQL under `/api/...` |
| Storage | `public.sf_*` (`role`, **`cms_access`**) | `payload` schema — stub linked by `coreUserId` |

**One login only:** Better Auth at `/login`. With `cms_access`, `/admin` is already authenticated (custom Payload strategy — no second password). Product **members** stay in core unless an admin turns CMS access on for them. Payload stays a swappable content module.

**Bootstrap path:** after seed, sign in as `admin@starforge.local` / `starforge-admin` at `/login`, then open `/admin` — no second prompt.

## Requirements

- **Node.js 22 LTS** (`^22.23.4` or newer LTS / Node 24+) — [nodejs.org](https://nodejs.org)
- **Docker Desktop** (or Docker Engine + Compose) — for local Postgres
- Git

## First-time local setup

```bash
git clone https://github.com/seraxes/starforge.git
cd starforge

# Start Postgres
docker compose up -d

# Env + install
cp .env.example .env
npm install

# Push core auth tables to public schema
npm run db:core:push

# Sample published pages (+ optional demo app user)
npm run seed

# Run the app
npm run dev
```

Then open **http://localhost:3000** (prefer `localhost`, not `127.0.0.1`, so cookies and CSRF stay consistent):

| URL | What |
| --- | --- |
| http://localhost:3000 | App shell (register / sign in / signed-in state) |
| http://localhost:3000/register | Create a **core app** account (email + password; auto sign-in; default role `member`) |
| http://localhost:3000/login | **Only** sign-in (Better Auth). Also used when `/admin` redirects unauthenticated visitors |
| http://localhost:3000/app/admin/users | Core admin — roles, **CMS access** switch, disable |
| http://localhost:3000/app/admin/settings | Core admin — site name, primary nav, feature toggles (same Payload global) |
| http://localhost:3000/app/admin/cms | Explains one-login CMS access + open `/admin` |
| http://localhost:3000/api/me | Current app session JSON including `role` / `isAdmin` (`401` when signed out) |
| http://localhost:3000/admin | Payload admin — already logged in when you have `cms_access` (no second password form) |
| http://localhost:3000/about | Sample published page (after `npm run seed`) |
| http://localhost:3000/getting-started | Sample published page |
| http://localhost:3000/welcome | Sample published page with SEO meta filled |
| http://localhost:3000/api/health | Core health JSON (`database: "up"` when Postgres is reachable) |

App login uses **email**, not a separate username. Forgot / reset password is **deferred** until outbound email is wired.

### Roles + bootstrap admin

| Role / flag | Who | Can open |
| --- | --- | --- |
| `admin` | Global **app** admin | `/app/admin/*`; **`cms_access` on by default** → `/admin` |
| `member` | Default product user | App routes only (no Payload stub unless CMS access toggled on) |
| `cms_access` | Per-user switch on Users | Payload `/admin` via Better Auth session |

### Site settings + feature toggles

One Payload global (`site-settings`) is the source of truth for site chrome and capability flags. Core admins edit it at **`/app/admin/settings`** (no CMS login required). CMS editors can edit the same document under Payload **Globals → Site settings**.

| Field | Default | What it does |
| --- | --- | --- |
| Site name | `Starforge` | Public header brand + metadata default |
| Primary nav | About, Getting started | Links in the public site header |
| Registration | on | Hide `/register` + reject signup when off |
| Rich editor | on | Flag reserved for a future simpler mode (Lexical stays on Pages today) |
| Posts | **off** | Placeholder — no Posts collection yet |
| Modules | **off** | Placeholder — first extension module not shipped |
| Draft preview | **off** | Placeholder — preview slice not shipped |

`npm run seed` ensures the global exists with those defaults. Flags are **product capabilities**, not npm libraries.

**First admin paths:**

1. `npm run seed` creates bootstrap admin `admin@starforge.local` / `starforge-admin` (role `admin` + `cms_access`) and a Payload stub. Sign in **once** at `/login`, then open `/admin` — already authenticated.
2. Or set `STARFORGE_ADMIN_EMAILS=you@example.com` in `.env`, **restart** `npm run dev`, reload while signed in — promoted to admin + CMS access.

Members visiting `/app/admin/users` are redirected home with an **Admins only** notice. Users without CMS access who open `/admin` get **No CMS access**. Disabled users cannot sign in.

### One-login CMS access

| Piece | Behavior |
| --- | --- |
| Auth | Custom Payload strategy reads the Better Auth session cookie |
| Flag | `sf_users.cms_access` — toggle on `/app/admin/users` (On/Off switch) |
| Enable | Sets flag + creates/links Payload stub (`coreUserId` + email) |
| Disable | Clears flag + deletes Payload stub |
| Unauthenticated `/admin` | Redirect → `/login?next=/admin` → return already in CMS |
| Members | Not provisioned unless an admin turns CMS access on |

### Seed (`npm run seed`)

Idempotent local demo data:

- **Published CMS pages:** `/about`, `/getting-started`, `/welcome`
- **Site settings** global defaults
- **Bootstrap app admin**: `admin@starforge.local` / `starforge-admin` → `admin` + `cms_access` + Payload stub
- **Demo app member**: `demo@starforge.local` / `starforge-demo` → `member`, **no** CMS access
- Promotes `STARFORGE_ADMIN_EMAILS` and grants them CMS access

### Edit pages in Payload admin (Lexical + SEO)

1. Sign in at **http://localhost:3000/login** as the seed admin, then open **http://localhost:3000/admin** (no second login).
2. **Media** → upload if needed (fill **Alt**).
3. **Pages** → edit a seeded page (Lexical + SEO tab).
4. **Publish** → open **http://localhost:3000/{slug}**. Drafts stay 404 for anonymous visitors.

Public render: `src/app/(frontend)/(public)/[slug]/page.tsx` · `getPublishedPageBySlug` · `buildPageMetadata`.

### Windows: one-login CMS smoke test

**Required after pull:** `npm run db:core:push` adds `sf_users.cms_access`.

```bat
cd starforge
git fetch origin
git checkout cursor/global-admin-cms-bridge-35ec
git pull origin cursor/global-admin-cms-bridge-35ec

docker compose up -d
if not exist .env copy .env.example .env
npm install
npm run db:core:push
npm run seed
npm run generate:importmap

rem Stop any old npm run dev window (Ctrl+C), then:
npm run dev
```

1. Open **http://localhost:3000/login** — sign in as `admin@starforge.local` / `starforge-admin` (**only** password prompt).
2. Open **http://localhost:3000/admin** — Payload dashboard should load **without** asking for email/password again. Edit a page under Pages.
3. Open **http://localhost:3000/app/admin/users** — confirm seed admin has **CMS access On**; demo member is **Off**. Toggle the demo member On, open `/admin` as that user after login; toggle Off and confirm deny (`/?notice=cms-denied`).
4. Sign out, visit `/admin` while logged out → should redirect to `/login?next=/admin`, then after login land in CMS.
5. Regression: `/app/admin/settings`, `/about`, pastel brand, `/api/health` → `"database":"up"`.

If Payload admin UI looks broken after pulling: `npm run generate:importmap`, then restart `npm run dev`.

### Useful commands

```bash
docker compose ps          # Postgres should be healthy
docker compose logs -f postgres
docker compose down        # stop DB (data kept in the named volume)
npm run seed               # sample published pages + optional demo app user
npm run generate:types     # regenerate src/payload-types.ts after collection edits
npm run generate:importmap # regenerate Payload admin import map if admin UI breaks
npm run db:core:push       # push Starforge core Drizzle schema to public
```

### Environment

`.env.example` already matches Compose:

```env
DATABASE_URL=postgresql://starforge:starforge@127.0.0.1:5432/starforge
PAYLOAD_SECRET=dev-only-change-me-to-a-long-random-string
BETTER_AUTH_SECRET=dev-only-better-auth-secret-change-me
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
# STARFORGE_ADMIN_EMAILS=you@example.com
```

Change `PAYLOAD_SECRET` and `BETTER_AUTH_SECRET` before any shared or non-local use.

## Project layout

```text
docker-compose.yml          # local Postgres only
docker/postgres/init.sql    # CREATE SCHEMA payload
src/
  app/
    (frontend)/             # public app shell + /login + /register + /[slug]
      (public)/             # site header (name + nav) from site-settings
      app/admin/            # core app admin (users + settings + CMS bridge)
    (payload)/              # Payload admin + REST/GraphQL (do not hand-edit)
    api/auth/               # Better Auth handler
    api/health/             # core health route
    api/me/                 # current app session
  collections/              # Payload content collections (Pages, Media, Users)
  globals/SiteSettings.ts   # site name, primary nav, feature toggles
  components/               # SiteHeader + RichText (Lexical → JSX)
  core/
    auth/                   # Better Auth + roles/admin helpers + Zod schemas
    cms-bridge/             # cms_access + Payload session strategy (one login)
    content/                # published CMS reads + page SEO metadata helpers
    settings/               # read/update site-settings + flag helpers
    db/                     # Drizzle core schema + client
  fields/pagesLexical.ts    # Lexical editor features for Pages
  seed.ts                   # pages + settings + bootstrap admin + CMS bridge + demo member
  payload.config.ts         # Payload config (content module)
```

## Not in this scaffold

- Production / DigitalOcean deploy
- Forgot / reset password (needs email — deferred), OAuth
- Second Payload password login (removed — Better Auth session strategy only)
- Draft preview (flag exists as placeholder), Posts collection, extension modules
- Airsoftnexus 2.0 feature parity

## Troubleshooting

1. **Docker not running** — start Docker Desktop; `docker compose ps` should show `starforge-postgres` healthy.
2. **Port 5432 or 3000 in use** — stop the other process, or change the host port in `docker-compose.yml` / Next’s port (`npm run dev -- -p 3001`).
3. **Payload admin import errors after upgrading** — run `npm run generate:importmap`.
4. **Fresh DB without `payload` schema** — Compose mounts `init.sql` only on first volume create. If you need to recreate: `docker compose down -v && docker compose up -d`.
5. **Auth tables missing / Better Auth schema errors** — run `npm run db:core:push` with Compose up and `.env` loaded.
6. **`column "impersonated_by" does not exist` (or missing `role` / `banned` on `sf_users`)** — code already defines these in `src/core/db/schema.ts`; your Postgres is behind. With Compose up: `npm run db:core:push`, then restart `npm run dev`.
7. **Seed fails on demo app user** — ensure `npm run db:core:push` succeeded; pages may still have been created.
8. **Windows** — use PowerShell or Command Prompt from the repo root; ensure Docker Desktop is **Running** before `docker compose up -d`. Copy env with `copy .env.example .env` if `cp` is unavailable. Always open the app as `http://localhost:3000` (mixing `127.0.0.1` can break sessions).
9. **Login says invalid email/password after register** — restart `npm run dev`; register a **new** email (or use seed demo); sign in with that **email**. Last resort: `docker compose down -v && docker compose up -d` then `npm run db:core:push` and `npm run seed`.
10. **Payload `/admin` asks for a password or denies access** — confirm `npm run db:core:push` applied `cms_access`, re-run `npm run seed`, sign in at `/login` first, then open `/admin`. Members need the Users **CMS access** switch On.
