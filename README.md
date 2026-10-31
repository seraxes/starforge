# Starforge

Reusable **product core** for ordinary web apps (auth, users, app shell, extension points) with **Payload CMS 3** as a swappable **content/media module** — not the whole product.

This is an early scaffold plus **core app auth** (Better Auth), **roles + core user admin**, **one-login Payload CMS access** (`cms_access` toggle), **site settings + feature toggles**, **Lexical** page editing, **public `/[slug]`** rendering, **page SEO fields**, **named layout positions + first extension module** (dismissible notice bar), and **`npm run seed`**. It is intentionally small and runnable locally — not Airsoftnexus 2.0 feature parity, and not a DigitalOcean deploy.

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
| http://localhost:3000/api/me | Current app session JSON including `role` / `isAdmin` (`401` when signed out) |
| http://localhost:3000/admin | Payload CMS — one nav link (**Payload CMS**) when `cms_access` is on; no second password |
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

### Site settings + primary nav + feature toggles

One Payload global (`site-settings`) is the source of truth for site chrome and capability flags. Core admins edit it at **`/app/admin/settings`** (no CMS login required). CMS editors can edit the same document under Payload **Globals → Site settings**.

| Field | Default | What it does |
| --- | --- | --- |
| Site name | `Starforge` | Public header brand + metadata default |
| Primary nav | Seed links **About**, **Getting started**, **Welcome** via **CMS page** relationships | Ordered header links; current path gets an active style. Prefer **CMS page**; **Custom URL** for paths / external links |
| Registration | on | Hide `/register` + reject signup when off |
| Rich editor | on | Flag reserved for a future simpler mode (Lexical stays on Pages today) |
| Posts | **off** | Placeholder — no Posts collection yet |
| Modules | **off** (seed turns **on**) | Render extension modules in named layout positions |
| Draft preview | **off** | Placeholder — preview slice not shipped |

`npm run seed` ensures the global exists, points primary nav at the sample pages, and **enables Modules** so the notice bar shows. Flags are **product capabilities**, not npm libraries.

### Extension modules + layout positions

Named positions in the public layout: **`header`**, **`after-content`**, **`footer`**. Any registered module can target any position (no hard locks). Assignments live in `src/core/modules/default-layout.json` — the path toward a later visual layout editor (same JSON/YAML shape under the hood).

| Piece | Where |
| --- | --- |
| Register API | `registerModule()` · `src/core/modules/` |
| Example module | `src/modules/notice-bar/` (dismissible notice) |
| Catalog boot | `src/modules/catalog.ts` |
| Layout document | `src/core/modules/default-layout.json` |
| Public slots | `<ModuleSlot position="…" />` in `(public)/layout.tsx` |

After seed, open **http://localhost:3000** — a pastel notice bar sits in the **header** position. Dismiss it (session only) or turn **Modules** off under `/app/admin/settings`. Docs: `src/core/modules/README.md`.

**Later (not in this slice):** nested menus, visual layout editor, draft preview, Joomla-like menu params beyond the stub `cssClass` / `browserTitle` fields (stubs are not applied on the public site yet).

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
- **Site settings** global defaults + **primary nav** linked to those pages (Payload relationships)
- **Modules** feature enabled + notice bar assigned to the **header** position
- **Bootstrap app admin**: `admin@starforge.local` / `starforge-admin` → `admin` + `cms_access` + Payload stub
- **Demo app member**: `demo@starforge.local` / `starforge-demo` → `member`, **no** CMS access
- Promotes `STARFORGE_ADMIN_EMAILS` and grants them CMS access

### Edit pages in Payload admin (Lexical + SEO)

1. Sign in at **http://localhost:3000/login** as the seed admin, then open **http://localhost:3000/admin** (no second login).
2. **Media** → upload if needed (fill **Alt**).
3. **Pages** → edit a seeded page (Lexical + SEO tab).
4. **Publish** → open **http://localhost:3000/{slug}**. Drafts stay 404 for anonymous visitors.

Public render: `src/app/(frontend)/(public)/[slug]/page.tsx` · `getPublishedPageBySlug` · `buildPageMetadata`.

### Windows: primary nav + public layout

```bat
cd %USERPROFILE%\starforge
git fetch origin
git checkout cursor/primary-nav-public-layout-4226
git pull origin cursor/primary-nav-public-layout-4226

docker compose up -d
if not exist .env copy .env.example .env
npm install
npm run db:core:push
npm run seed
npm run generate:types

rem Stop ANY old npm run dev window (Ctrl+C), then:
npm run dev
```

PowerShell equivalent start: `cd $env:USERPROFILE\starforge`

1. Open **http://localhost:3000** — header shows site name (**Starforge**) + nav (**About**, **Getting started**, **Welcome**).
2. Open **http://localhost:3000/about** — **About** nav link is active (underlined / primary color).
3. Open **http://localhost:3000/getting-started** and **/welcome** — matching nav item active.
4. Sign in at **/login** as `admin@starforge.local` / `starforge-admin`, open **/admin** → Globals → **Site settings** — primary nav items use **CMS page** link type.
5. Optional: **/app/admin/settings** still edits site name / path nav / toggles.

### Windows: one-login CMS smoke test

**How it works now:** core `/login` (Better Auth) → `/admin` or `/admin/login` is blocked by middleware → `/api/cms/exchange` sets a Payload `payload-token` JWT → Payload **Dashboard**. Payload’s stock email/password form is never served.

**Required after pull:** `npm run db:core:push` (adds `sf_users.cms_access`), then **fully stop and restart** `npm run dev` (middleware only loads on process start).

```bat
cd %USERPROFILE%\starforge
git fetch origin
git checkout main
git pull origin main

docker compose up -d
if not exist .env copy .env.example .env
npm install
npm run db:core:push
npm run seed
npm run generate:importmap

rem Stop ANY old npm run dev window (Ctrl+C). Auth/config does not hot-reload.
npm run dev
```

1. Use **http://localhost:3000** only (not `127.0.0.1`).
2. Open **http://localhost:3000/login** — sign in as `admin@starforge.local` / `starforge-admin` (**only** password prompt in the whole flow).
3. Open **http://localhost:3000/admin** — briefly `/api/cms/exchange`, then Payload **Dashboard** (no email/password form). Edit a page under Pages.
4. Also try **http://localhost:3000/admin/login** — must redirect away (never show Payload’s password form). Hard-refresh (Ctrl+F5) if an old login page was cached.
5. **http://localhost:3000/app/admin/users** — seed admin **CMS access On**; demo member **Off**.
6. Sign out → `/admin` → core `/login?next=/admin` → after login, CMS again with no second form.

Optional checks: `npm run verify:cms-sso` and `npm run verify:admin-no-login-form`.

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
      (public)/             # site header + ModuleSlots (header / after-content / footer)
      app/admin/            # core app admin (users + settings + CMS bridge)
    (payload)/              # Payload admin + REST/GraphQL (do not hand-edit)
    api/auth/               # Better Auth handler
    api/health/             # core health route
    api/me/                 # current app session
  collections/              # Payload content collections (Pages, Media, Users)
  globals/SiteSettings.ts   # site name, primary nav (page/URL), feature toggles
  components/               # SiteHeader + SiteNav + RichText (Lexical → JSX)
  modules/                  # extension modules (notice-bar) + catalog register
  core/
    auth/                   # Better Auth + roles/admin helpers + Zod schemas
    cms-bridge/             # cms_access + Payload session strategy (one login)
    content/                # published CMS reads + page SEO metadata helpers
    modules/                # register API, layout JSON, ModuleSlot
    settings/               # site-settings + nav resolve + flag helpers
    db/                     # Drizzle core schema + client
  fields/pagesLexical.ts    # Lexical editor features for Pages
  seed.ts                   # pages + settings + modules on + bootstrap admin + demo member
  payload.config.ts         # Payload config (content module)
```

## Not in this scaffold

- Production / DigitalOcean deploy
- Forgot / reset password (needs email — deferred), OAuth
- Second Payload password login (removed — Better Auth session strategy only)
- Draft preview (flag exists as placeholder), Posts collection
- Visual layout editor (layout JSON exists; editor comes later), Gantry-full UX
- Nested menus, Joomla-like menu CSS / browser-title overrides (stub fields only)
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
