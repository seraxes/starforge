# Starforge

Reusable **product core** for ordinary web apps (auth, users, app shell, extension points) with **Payload CMS 3** as a swappable **content/media module** — not the whole product.

This is an early scaffold plus **core app auth** (Better Auth), **roles + core user admin**, **Lexical** page editing, **public `/[slug]`** rendering, **page SEO fields**, and **`npm run seed`**. It is intentionally small and runnable locally — not Airsoftnexus 2.0 feature parity, and not a DigitalOcean deploy.

## Architecture

| Layer | Owns | Location |
| --- | --- | --- |
| **Starforge core** | Product APIs, auth/sessions/users, Drizzle tables in Postgres `public` | `src/core/`, `src/app/api/` |
| **Payload content module** | Collections, drafts, media, CMS admin | `src/collections/`, `src/payload.config.ts`, `src/app/(payload)/` |

- Payload tables use Postgres schema **`payload`** (created by `docker/postgres/init.sql`).
- Core auth tables: `sf_users`, `sf_sessions`, `sf_accounts`, `sf_verifications` (push with `npm run db:core:push`).
- Hot paths stay in core — do not put high-QPS app traffic through Payload Local API.

### App users ≠ Payload CMS users

| | Starforge app account | Payload CMS editor |
| --- | --- | --- |
| Purpose | Product login (membership, gated app features) | Edit pages/media in the CMS |
| UI | `/register`, `/login`, signed-in indicator on `/`; admins also `/app/admin/users` | **`/admin`** (content only) |
| API | Better Auth `/api/auth/*`, `GET /api/me` | Payload REST/GraphQL under `/api/...` |
| Storage | `public.sf_*` via Drizzle (`role`: `admin` \| `member`) | `payload` schema via Payload |

**`/admin` = CMS content. `/login` = app accounts. `/app/admin/users` = core app-user admin.** Creating a user in one place does **not** create a user in the other. Product users stay in core — never moved into Payload. Seed never creates a CMS editor — open `/admin` once to create the first editor in the browser.

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
| http://localhost:3000/api/me | Current app session JSON including `role` / `isAdmin` (`401` when signed out) |
| http://localhost:3000/admin | Payload admin — **content** (pages, media); create first **CMS editor** on first visit |
| http://localhost:3000/about | Sample published page (after `npm run seed`) |
| http://localhost:3000/getting-started | Sample published page |
| http://localhost:3000/welcome | Sample published page with SEO meta filled |
| http://localhost:3000/api/health | Core health JSON (`database: "up"` when Postgres is reachable) |

App login uses **email**, not a separate username. Forgot / reset password is **deferred** until outbound email is wired.

### Roles + bootstrap admin

| Role | Who | Can open |
| --- | --- | --- |
| `admin` | Global **app** admin | `/app/admin/users` (+ normal app routes) |
| `member` | Default product user | App routes only |

**First admin paths:**

1. `npm run seed` creates bootstrap admin `admin@starforge.local` / `starforge-admin` (role `admin`).
2. Or set `STARFORGE_ADMIN_EMAILS=you@example.com` in `.env`, then register that email (or re-run seed to promote existing matches).

Members cannot open `/app/admin/users` (redirect to login). Disabled users cannot sign in.

### Seed (`npm run seed`)

Idempotent local demo data:

- **Published CMS pages:** `/about`, `/getting-started`, `/welcome` (Lexical body + SEO meta title/description). Skips slugs that already exist.
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

### Windows: roles + core user admin smoke test

**Required after every pull of this branch:** `npm run db:core:push` adds Better Auth admin columns (`sf_users.role` / `banned` / … and `sf_sessions.impersonated_by`). Skipping push causes `/app/admin/users` errors like `column "impersonated_by" does not exist`.

Already on the branch? Pull + push schema + restart:

```bat
cd starforge
git pull origin cursor/core-roles-user-admin-ace5
npm run db:core:push

rem Stop the old npm run dev window (Ctrl+C), then:
npm run dev
```

Fresh checkout / first-time on this branch:

```bat
cd starforge
git fetch origin
git checkout cursor/core-roles-user-admin-ace5
git pull origin cursor/core-roles-user-admin-ace5

docker compose up -d
if not exist .env copy .env.example .env
npm install
npm run db:core:push
npm run seed

rem Stop any old npm run dev window (Ctrl+C), then:
npm run dev
```

1. Open **http://localhost:3000/login** — sign in as bootstrap admin `admin@starforge.local` / `starforge-admin`.
2. Home should show role **admin** and a **Core user admin** link. Open **http://localhost:3000/app/admin/users**.
3. Confirm both seed users appear. Set the demo member’s role or **Disable** them, then try signing in as `demo@starforge.local` / `starforge-demo` (disabled → blocked; enable again to restore).
4. Sign out, sign in as the demo member — visiting `/app/admin/users` should redirect to home (members are not admins).
5. Confirm **http://localhost:3000/about** still renders, **http://localhost:3000/admin** still uses a separate CMS editor, Lexical/SEO still work, pastel brand still shows, **http://localhost:3000/api/health** is `"database":"up"`, and `/api/me` includes `role` / `isAdmin`.

Optional: set `STARFORGE_ADMIN_EMAILS=you@example.com` in `.env`, register that email, confirm it becomes `admin` after signup (or after `npm run seed`).

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
      app/admin/            # core app admin (users) — not Payload
    (payload)/              # Payload admin + REST/GraphQL (do not hand-edit)
    api/auth/               # Better Auth handler
    api/health/             # core health route
    api/me/                 # current app session
  collections/              # Payload content collections (Pages, Media, Users)
  components/RichText/      # Lexical → JSX for public pages
  core/
    auth/                   # Better Auth + roles/admin helpers + Zod schemas
    content/                # published CMS reads + page SEO metadata helpers
    db/                     # Drizzle core schema + client
  fields/pagesLexical.ts    # Lexical editor features for Pages
  seed.ts                   # npm run seed — sample pages + bootstrap admin + demo member
  payload.config.ts         # Payload config (content module)
```

## Not in this scaffold

- Production / DigitalOcean deploy
- Forgot / reset password (needs email — deferred), OAuth
- Global-admin → Payload CMS login bridge (follow-up)
- Draft preview, nav/site settings, extension modules
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
