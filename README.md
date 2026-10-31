# Starforge

Reusable **product core** for ordinary web apps (auth, users, app shell, extension points) with **Payload CMS 3** as a swappable **content/media module** — not the whole product.

This is an early scaffold plus **core app auth** (Better Auth), **roles + core user admin**, **site settings + feature toggles**, **Lexical** page editing, **public `/[slug]`** rendering, **page SEO fields**, and **`npm run seed`**. It is intentionally small and runnable locally — not Airsoftnexus 2.0 feature parity, and not a DigitalOcean deploy.

## Architecture

| Layer | Owns | Location |
| --- | --- | --- |
| **Starforge core** | Product APIs, auth/sessions/users, Drizzle tables in Postgres `public` | `src/core/`, `src/app/api/` |
| **Payload content module** | Collections, globals (site settings), drafts, media, CMS admin | `src/collections/`, `src/globals/`, `src/payload.config.ts`, `src/app/(payload)/` |

- Payload tables use Postgres schema **`payload`** (created by `docker/postgres/init.sql`).
- Core auth tables: `sf_users`, `sf_sessions`, `sf_accounts`, `sf_verifications` (push with `npm run db:core:push`).
- Hot paths stay in core — do not put high-QPS app traffic through Payload Local API.

### App users ≠ Payload CMS users

| | Starforge app account | Payload CMS editor |
| --- | --- | --- |
| Purpose | Product login (membership, gated app features) | Edit pages/media in the CMS |
| UI | `/register`, `/login`, signed-in indicator on `/`; admins also `/app/admin/*` | **`/admin`** (content + Site settings global) |
| API | Better Auth `/api/auth/*`, `GET /api/me` | Payload REST/GraphQL under `/api/...` |
| Storage | `public.sf_*` via Drizzle (`role`: `admin` \| `member`) | `payload` schema via Payload |

**`/admin` = CMS content (+ Site settings global). `/login` = app accounts. `/app/admin` = core users + feature toggles.** Creating a user in one place does **not** create a user in the other. Product users stay in core — never moved into Payload. Seed never creates a CMS editor — open `/admin` once to create the first editor in the browser.

A core `admin` role does **not** yet unlock Payload `/admin`. **Global-admin → CMS bridge is a follow-up** (preference: one platform admin reaches all areas).

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
| http://localhost:3000/login | Sign in as an **app** user (not CMS) |
| http://localhost:3000/app/admin/users | Core admin — list users, set `admin`/`member`, disable (requires app `admin`) |
| http://localhost:3000/app/admin/settings | Core admin — site name, primary nav, feature toggles (same Payload global) |
| http://localhost:3000/api/me | Current app session JSON including `role` / `isAdmin` (`401` when signed out) |
| http://localhost:3000/admin | Payload admin — **content** (pages, media) + **Globals → Site settings**; create first **CMS editor** on first visit |
| http://localhost:3000/about | Sample published page (after `npm run seed`) |
| http://localhost:3000/getting-started | Sample published page |
| http://localhost:3000/welcome | Sample published page with SEO meta filled |
| http://localhost:3000/api/health | Core health JSON (`database: "up"` when Postgres is reachable) |

App login uses **email**, not a separate username. Forgot / reset password is **deferred** until outbound email is wired.

### Roles + bootstrap admin

| Role | Who | Can open |
| --- | --- | --- |
| `admin` | Global **app** admin | `/app/admin/users`, `/app/admin/settings` (+ normal app routes) |
| `member` | Default product user | App routes only |

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

1. `npm run seed` creates bootstrap admin `admin@starforge.local` / `starforge-admin` (role `admin`). Sign in with that on `/login` (not Payload `/admin`).
2. Or set `STARFORGE_ADMIN_EMAILS=you@example.com` in `.env`, **restart** `npm run dev`, then reload while signed in as that email — role is promoted to `admin` on the next request (also on signup / seed).

Members visiting `/app/admin/users` are redirected home with an **Admins only** notice — expected. Disabled users cannot sign in.

### Seed (`npm run seed`)

Idempotent local demo data:

- **Published CMS pages:** `/about`, `/getting-started`, `/welcome` (Lexical body + SEO meta title/description). Skips slugs that already exist.
- **Site settings** global: site name, sample primary nav, feature-toggle defaults
- **Bootstrap app admin** (core only): `admin@starforge.local` / `starforge-admin` → role `admin`
- **Demo app member** (core `/login` only): `demo@starforge.local` / `starforge-demo` → role `member`
- Promotes any emails listed in `STARFORGE_ADMIN_EMAILS`
- **Does not** create a Payload CMS editor — use `/admin` first-run for that.

Console output repeats the CMS vs app-user split.

### Edit pages in Payload admin (Lexical + SEO)

1. Open **http://localhost:3000/admin** and create the first **CMS editor** (email + password). This is separate from app `/register` / seed demo accounts.
2. In the sidebar: **Media** → upload an image (fill in **Alt** text) if you want an OG image.
3. Open **Pages** → create or edit a page (seed already added three published samples).
4. **Content** tab: Lexical body (toolbar or `/` slash menu — headings, lists, links, Media images).
5. **SEO** tab: meta title, meta description, optional OG image (Media relation). Used by public `/[slug]` `<head>` / Open Graph.
6. **Save Draft** while writing; **Publish** when the page should be public.
7. Open **http://localhost:3000/{slug}**. Drafts return **404** for anonymous visitors.

Public render: `src/app/(frontend)/[slug]/page.tsx` · `getPublishedPageBySlug` · `buildPageMetadata`.

### Windows: site settings + feature toggles smoke test

No new core Drizzle columns in this slice (site settings live in the Payload `site-settings` global). Still run `npm run db:core:push` if your DB is behind on auth/role columns from earlier PRs.

Already on the branch? Pull + seed defaults + restart:

```bat
cd starforge
git pull origin cursor/site-settings-feature-toggles-cd64
npm run seed

rem Stop the old npm run dev window (Ctrl+C), then:
npm run dev
```

Fresh checkout / first-time on this branch:

```bat
cd starforge
git fetch origin
git checkout cursor/site-settings-feature-toggles-cd64
git pull origin cursor/site-settings-feature-toggles-cd64

docker compose up -d
if not exist .env copy .env.example .env
npm install
npm run db:core:push
npm run seed

rem Stop any old npm run dev window (Ctrl+C), then:
npm run dev
```

1. Open **http://localhost:3000** — public header should show site name **Starforge** and nav links (About / Getting started after seed).
2. Sign in as bootstrap admin `admin@starforge.local` / `starforge-admin` → open **http://localhost:3000/app/admin/settings**.
3. Change the site name, add/remove a nav item, **uncheck Registration**, Save. Confirm home header updates and the Register link is gone; **http://localhost:3000/register** shows “Registration closed”; signup is rejected if forced.
4. Re-enable Registration and Save. Confirm Register returns.
5. Optional: open Payload **http://localhost:3000/admin** → Globals → Site settings (CMS editor login) and confirm the same values; edit there and reload the public site.
6. Regression: **http://localhost:3000/app/admin/users** still works; **http://localhost:3000/about** still renders Lexical/SEO; pastel brand still shows; **http://localhost:3000/api/health** is `"database":"up"`; login/logout unchanged.

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
      app/admin/            # core app admin (users + settings) — not Payload
    (payload)/              # Payload admin + REST/GraphQL (do not hand-edit)
    api/auth/               # Better Auth handler
    api/health/             # core health route
    api/me/                 # current app session
  collections/              # Payload content collections (Pages, Media, Users)
  globals/SiteSettings.ts   # site name, primary nav, feature toggles
  components/               # SiteHeader + RichText (Lexical → JSX)
  core/
    auth/                   # Better Auth + roles/admin helpers + Zod schemas
    content/                # published CMS reads + page SEO metadata helpers
    settings/               # read/update site-settings + flag helpers
    db/                     # Drizzle core schema + client
  fields/pagesLexical.ts    # Lexical editor features for Pages
  seed.ts                   # npm run seed — pages + settings + bootstrap admin + demo member
  payload.config.ts         # Payload config (content module)
```

## Not in this scaffold

- Production / DigitalOcean deploy
- Forgot / reset password (needs email — deferred), OAuth
- Global-admin → Payload CMS login bridge (follow-up)
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
9. **Login says invalid email/password after register** — confirm recent main (auth fix commits); restart `npm run dev`; register a **new** email (or use seed demo); sign in with that **email** (not display name). Payload `/admin` users are separate. Last resort: `docker compose down -v && docker compose up -d` then `npm run db:core:push` and `npm run seed`.
