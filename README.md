# Starforge

Reusable **product core** for ordinary web apps (auth, users, app shell, extension points) with **Payload CMS 3** as a swappable **content/media module** — not the whole product.

This is an early scaffold plus **core app auth** (Better Auth), **roles + core user admin**, **global-admin → Payload CMS bridge**, **site settings + feature toggles**, **Lexical** page editing, **public `/[slug]`** rendering, **page SEO fields**, and **`npm run seed`**. It is intentionally small and runnable locally — not Airsoftnexus 2.0 feature parity, and not a DigitalOcean deploy.

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

**`/admin` = CMS content (+ Site settings global). `/login` = app accounts. `/app/admin` = core users + feature toggles + CMS access bridge.** Product **members** stay in core — never moved into Payload. **Global admins** get a *linked* Payload editor (same email) via `npm run seed` or **Core admin → CMS access** (`/app/admin/cms`). Sessions stay separate (sign in once at `/login` for the app, once at `/admin` for CMS).

**Bootstrap path:** after seed, `admin@starforge.local` / `starforge-admin` works for **both** `/login` and `/admin`.

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
| http://localhost:3000/app/admin/cms | Core admin — ensure linked Payload CMS editor + open `/admin` |
| http://localhost:3000/api/me | Current app session JSON including `role` / `isAdmin` (`401` when signed out) |
| http://localhost:3000/admin | Payload admin — **content** (pages, media) + **Globals → Site settings**; seed links bootstrap admin as CMS editor |
| http://localhost:3000/about | Sample published page (after `npm run seed`) |
| http://localhost:3000/getting-started | Sample published page |
| http://localhost:3000/welcome | Sample published page with SEO meta filled |
| http://localhost:3000/api/health | Core health JSON (`database: "up"` when Postgres is reachable) |

App login uses **email**, not a separate username. Forgot / reset password is **deferred** until outbound email is wired.

### Roles + bootstrap admin

| Role | Who | Can open |
| --- | --- | --- |
| `admin` | Global **app** admin | `/app/admin/*` **and** linked Payload `/admin` (CMS editor, same email) |
| `member` | Default product user | App routes only (not synced into Payload) |

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

1. `npm run seed` creates bootstrap admin `admin@starforge.local` / `starforge-admin` (role `admin`) **and** a linked Payload CMS editor with the **same** credentials. Sign in on `/login` for core admin; sign in on `/admin` for CMS (same email/password).
2. Or set `STARFORGE_ADMIN_EMAILS=you@example.com` in `.env`, **restart** `npm run dev`, then reload while signed in as that email — role is promoted to `admin` on the next request (also on signup / seed). Seed (or **CMS access → Ensure**) links a Payload editor using `STARFORGE_CMS_BRIDGE_PASSWORD` (default `starforge-admin`).

Members visiting `/app/admin/users` are redirected home with an **Admins only** notice — expected. Disabled users cannot sign in.

### Global admin → Payload CMS bridge

| Piece | Behavior |
| --- | --- |
| Seed | Creates Payload `users` row for `admin@starforge.local` (password `starforge-admin`) and for any `STARFORGE_ADMIN_EMAILS` (bridge password) |
| Core UI | `/app/admin/cms` — status, **Ensure my CMS editor account**, **Open Payload CMS** |
| Sessions | Separate cookies — not SSO; keeps Payload swappable as a content module |
| Members | Never auto-provisioned into Payload |

### Seed (`npm run seed`)

Idempotent local demo data:

- **Published CMS pages:** `/about`, `/getting-started`, `/welcome` (Lexical body + SEO meta title/description). Skips slugs that already exist.
- **Site settings** global: site name, sample primary nav, feature-toggle defaults
- **Bootstrap app admin**: `admin@starforge.local` / `starforge-admin` → role `admin`
- **Linked Payload CMS editor** for that bootstrap admin (same email/password)
- **Demo app member** (core `/login` only): `demo@starforge.local` / `starforge-demo` → role `member` (no CMS user)
- Promotes any emails listed in `STARFORGE_ADMIN_EMAILS` and links CMS editors for them

### Edit pages in Payload admin (Lexical + SEO)

1. After seed, open **http://localhost:3000/admin** and sign in as `admin@starforge.local` / `starforge-admin` (or use **CMS access** from core admin). Additional CMS-only editors can still be created in Payload.
2. In the sidebar: **Media** → upload an image (fill in **Alt** text) if you want an OG image.
3. Open **Pages** → create or edit a page (seed already added three published samples).
4. **Content** tab: Lexical body (toolbar or `/` slash menu — headings, lists, links, Media images).
5. **SEO** tab: meta title, meta description, optional OG image (Media relation). Used by public `/[slug]` `<head>` / Open Graph.
6. **Save Draft** while writing; **Publish** when the page should be public.
7. Open **http://localhost:3000/{slug}**. Drafts return **404** for anonymous visitors.

Public render: `src/app/(frontend)/(public)/[slug]/page.tsx` · `getPublishedPageBySlug` · `buildPageMetadata`.

### Windows: global-admin CMS bridge smoke test

No new core Drizzle columns in this slice. Still run `npm run db:core:push` if your DB is behind on auth/role columns from earlier PRs.

Already on the branch? Pull + seed + restart:

```bat
cd starforge
git pull origin cursor/global-admin-cms-bridge-35ec
npm run seed

rem Stop the old npm run dev window (Ctrl+C), then:
npm run dev
```

Fresh checkout / first-time on this branch:

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

rem Stop any old npm run dev window (Ctrl+C), then:
npm run dev
```

1. Open **http://localhost:3000/login** — sign in as `admin@starforge.local` / `starforge-admin`.
2. Open **http://localhost:3000/app/admin/cms** — should show CMS editor **linked** (after seed). Click **Open Payload CMS**.
3. At **http://localhost:3000/admin**, sign in with the **same** email/password. Confirm you can open **Pages** and edit a sample page.
4. Confirm **http://localhost:3000/app/admin/users** and **http://localhost:3000/app/admin/settings** still work; member `demo@starforge.local` is **not** a CMS editor.
5. Regression: **http://localhost:3000/about** still renders; pastel brand still shows; **http://localhost:3000/api/health** is `"database":"up"`.

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
# STARFORGE_CMS_BRIDGE_PASSWORD=starforge-admin
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
    cms-bridge/             # link global admins → Payload CMS editors
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
- Shared-session SSO into Payload (linked accounts are the bridge)
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
9. **Login says invalid email/password after register** — confirm recent main (auth fix commits); restart `npm run dev`; register a **new** email (or use seed demo); sign in with that **email** (not display name). Payload `/admin` uses a linked editor for global admins (seed / `/app/admin/cms`), not the member demo account. Last resort: `docker compose down -v && docker compose up -d` then `npm run db:core:push` and `npm run seed`.
10. **Payload `/admin` rejects seed admin** — re-run `npm run seed` (creates the linked CMS editor if missing), or open `/app/admin/cms` → **Ensure my CMS editor account**, then sign in with `admin@starforge.local` / `starforge-admin`.
