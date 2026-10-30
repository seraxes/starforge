# Starforge

Reusable **product core** for ordinary web apps (auth, users, app shell, extension points) with **Payload CMS 3** as a swappable **content/media module** — not the whole product.

This is an early scaffold plus **core app auth** (Better Auth). It is intentionally small and runnable locally — not Airsoftnexus 2.0 feature parity, and not a DigitalOcean deploy.

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
| UI | `/register`, `/login`, signed-in indicator on `/` | `/admin` |
| API | Better Auth `/api/auth/*`, `GET /api/me` | Payload REST/GraphQL under `/api/...` |
| Storage | `public.sf_*` via Drizzle | `payload` schema via Payload |

Creating a user in one place does **not** create a user in the other.

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

# Run the app
npm run dev
```

Then open **http://localhost:3000** (prefer `localhost`, not `127.0.0.1`, so cookies and CSRF stay consistent):

| URL | What |
| --- | --- |
| http://localhost:3000 | App shell (register / sign in / signed-in state) |
| http://localhost:3000/register | Create a **core app** account (email + password; auto sign-in) |
| http://localhost:3000/login | Sign in as an app user (same email + password) |
| http://localhost:3000/api/me | Current app session JSON (`401` when signed out) |
| http://localhost:3000/admin | Payload admin (create first **CMS editor** on first visit) |
| http://localhost:3000/about | Example: published CMS page with slug `about` (404 until you create + Publish it) |
| http://localhost:3000/api/health | Core health JSON (`database: "up"` when Postgres is reachable) |

App login uses **email**, not a separate username. Forgot / reset password is **deferred** until outbound email is wired.

### Edit pages in Payload admin (Lexical)

CMS content uses **Payload Lexical** (not TipTap): headings, lists, links, and images from **Media**, with a fixed toolbar.

1. Open **http://localhost:3000/admin** and create the first **CMS editor** (email + password). This is separate from app `/register` accounts.
2. In the sidebar: **Media** → upload an image (fill in **Alt** text).
3. Open **Pages** → **Create new**.
4. Set **Title** and **Slug** (sidebar), e.g. title `About`, slug `about`.
5. In **Body**, use the toolbar or type `/` for the slash menu:
   - Headings (H1–H4), bold/italic, lists
   - Link (external URL or another Page)
   - Upload / insert image from **Media**
6. Use **Save Draft** while writing; click **Publish** when the page should be public.
7. Open **http://localhost:3000/{slug}** (e.g. `/about`). Drafts and unpublished pages return **404** for anonymous visitors.

Public render lives in `src/app/(frontend)/[slug]/page.tsx` and uses `getPublishedPageBySlug` in `src/core/content/pages.ts`.

### Windows: Lexical Pages smoke test

After this branch is checked out (or merged to `main`):

```bat
cd starforge
git fetch origin
git checkout cursor/payload-lexical-pages-3c8a
git pull origin cursor/payload-lexical-pages-3c8a

docker compose up -d
if not exist .env copy .env.example .env
npm install
npm run db:core:push

rem Stop any old npm run dev window (Ctrl+C), then:
npm run dev
```

1. Open **http://localhost:3000/admin** — create first CMS editor if prompted.
2. **Media** → upload a small image with alt text.
3. **Pages** → Create → title `About`, slug `about`.
4. In Body: add a heading, a bullet list, a link, and insert the Media image (toolbar or `/`).
5. Click **Publish** (not only Save Draft).
6. Open **http://localhost:3000/about** — heading, list, link, and image should render.
7. Confirm **http://localhost:3000/api/health** still shows `"database":"up"`.
8. Optional: app auth still works at `/register` / `/login` (separate from CMS editors).

If admin UI looks broken after pulling editor changes: `npm run generate:importmap`, then restart `npm run dev`.

### Useful commands

```bash
docker compose ps          # Postgres should be healthy
docker compose logs -f postgres
docker compose down        # stop DB (data kept in the named volume)
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
```

Change `PAYLOAD_SECRET` and `BETTER_AUTH_SECRET` before any shared or non-local use.

## Project layout

```text
docker-compose.yml          # local Postgres only
docker/postgres/init.sql    # CREATE SCHEMA payload
src/
  app/
    (frontend)/             # public app shell + /login + /register + /[slug]
    (payload)/              # Payload admin + REST/GraphQL (do not hand-edit)
    api/auth/               # Better Auth handler
    api/health/             # core health route
    api/me/                 # current app session
  collections/              # Payload content collections (Pages, Media, Users)
  components/RichText/      # Lexical → JSX for public pages
  core/
    auth/                   # Better Auth config + client + Zod schemas
    content/                # published CMS reads for the public site
    db/                     # Drizzle core schema + client
  fields/pagesLexical.ts    # Lexical editor features for Pages
  payload.config.ts         # Payload config (content module)
```

## Not in this scaffold

- Production / DigitalOcean deploy
- Forgot / reset password (needs email — deferred), roles, OAuth
- SEO fields, seed script, draft preview
- Airsoftnexus 2.0 feature parity

## Troubleshooting

1. **Docker not running** — start Docker Desktop; `docker compose ps` should show `starforge-postgres` healthy.
2. **Port 5432 or 3000 in use** — stop the other process, or change the host port in `docker-compose.yml` / Next’s port (`npm run dev -- -p 3001`).
3. **Payload admin import errors after upgrading** — run `npm run generate:importmap`.
4. **Fresh DB without `payload` schema** — Compose mounts `init.sql` only on first volume create. If you need to recreate: `docker compose down -v && docker compose up -d`.
5. **Auth tables missing / Better Auth schema errors** — run `npm run db:core:push` with Compose up and `.env` loaded.
6. **Windows** — use PowerShell or Command Prompt from the repo root; ensure Docker Desktop is **Running** before `docker compose up -d`. Copy env with `copy .env.example .env` if `cp` is unavailable. Always open the app as `http://localhost:3000` (mixing `127.0.0.1` can break sessions).
7. **Login says invalid email/password after register** — confirm `git log -1` shows `784d596` or newer; restart `npm run dev`; register a **new** email (old pre-fix users can be bad); sign in with that **email** (not display name). Payload `/admin` users are separate. Last resort: `docker compose down -v && docker compose up -d` then `npm run db:core:push`.
