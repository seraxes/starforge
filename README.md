# Starforge

Reusable **product core** for ordinary web apps (auth, users, app shell, extension points) with **Payload CMS 3** as a swappable **content/media module** — not the whole product.

**Two admin surfaces, one login:** **Starforge admin** (`/app/admin` — users, groups, site settings, nav, layouts) ↔ **Payload Content CMS** (`/admin` — pages, media); each sidebar links to the other.

This is an early scaffold plus **core app auth** (Better Auth), **roles + user groups + ACL stub**, **one-login Payload CMS access** (`cms_access` toggle), **site settings + feature toggles**, **Nav manager**, **Page Settings** (Gantry-style Head / Assets / Body / Font Awesome / Atoms + layout assignment in `sf_page_chrome`), **Lexical** page editing, **public `/[slug]`** rendering, **draft preview** (`/preview/[slug]`), **published content cache** (Next.js tags; Redis later), **page SEO fields**, **extension modules + Gantry-like layout manager** (sections/rows/slots + % widths in `sf_layouts`, palette UI at `/app/admin/layouts`, typed Logo/Copyright/Social + page-content + Custom particles), and **`npm run seed`**. It is intentionally small and runnable locally — not Airsoftnexus 2.0 feature parity, and not a DigitalOcean deploy.

## Architecture

| Layer | Owns | Location |
| --- | --- | --- |
| **Starforge core** | Product APIs, auth/sessions/users, Drizzle tables in Postgres `public` | `src/core/`, `src/app/api/` |
| **Payload content module** | Collections, globals (site settings), drafts, media, CMS admin | `src/collections/`, `src/globals/`, `src/payload.config.ts`, `src/app/(payload)/` |

- Payload tables use Postgres schema **`payload`** (created by `docker/postgres/init.sql`).
- Core auth + layout + page chrome + nav + groups/ACL tables: `sf_users`, `sf_sessions`, `sf_accounts`, `sf_verifications`, `sf_layouts`, `sf_page_chrome`, `sf_nav_menus`, `sf_user_groups`, `sf_user_group_members`, `sf_acl_permissions` (push with `npm run db:core:push`).
- Hot paths stay in core — do not put high-QPS app traffic through Payload Local API.

### Published content cache

Anonymous `/[slug]` and public site chrome load through core helpers (`getPublishedPageBySlug`, `getSiteSettings`) backed by a small **pluggable cache**:

| Piece | Behavior |
| --- | --- |
| Default (local) | Next.js `unstable_cache` + cache tags (`sf:published-page:{slug}`, `sf:site-settings`, …) |
| Revalidate | Payload `afterChange` / `afterDelete` on Pages + Site settings call `invalidatePublishedPage` / `invalidateSiteSettings` |
| Draft preview | `/preview/[slug]` stays **uncached** and auth-gated (`cms_access` + feature toggle) |
| Redis | **Planned for DigitalOcean production** (multi-instance). Not required locally. Same loader API — swap backend via `STARFORGE_CONTENT_CACHE=redis` once Redis is wired (`src/core/content/cache/`). |

Do not call Payload Local API from hot anonymous paths except through these helpers.

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
| http://localhost:3000/app/admin/users | Starforge admin — accounts (roles, groups, **CMS access**, disable) |
| http://localhost:3000/app/admin/users/groups | Starforge admin — **user groups** |
| http://localhost:3000/app/admin/users/acl | Starforge admin — **ACL** stub matrix + view-access overview |
| http://localhost:3000/app/admin/site-chrome | Starforge admin — **Site Chrome** (offline, metadata, robots, cookies) |
| http://localhost:3000/app/admin/settings | Starforge admin — Modules on/off + primary nav menu assignment |
| http://localhost:3000/app/admin/nav | Starforge admin — **Nav** manager (navigation sets + items) |
| http://localhost:3000/robots.txt | Site Chrome robots.txt snippet |
| http://localhost:3000/app/admin/layouts | Starforge admin — **Layouts** (hover submenu) → **Layout** canvas (default) |
| http://localhost:3000/app/admin/page-settings | Starforge admin — **Layouts → Page settings** (Head / Assets / Body / FA / Atoms) |
| http://localhost:3000/api/me | Current app session JSON including `role` / `isAdmin` (`401` when signed out) |
| http://localhost:3000/admin | Payload Content CMS — nav **Payload CMS** when `cms_access` is on; sidebar **Core admin** → `/app/admin` |
| http://localhost:3000/about | Sample published page (after `npm run seed`) |
| http://localhost:3000/getting-started | Sample published page |
| http://localhost:3000/welcome | Sample published page with SEO meta filled |
| http://localhost:3000/preview/{slug} | Draft preview (CMS access + **Draft preview** toggle on) |
| http://localhost:3000/api/health | Core health JSON (`database: "up"` when Postgres is reachable) |

App login uses **email**, not a separate username. Forgot / reset password is **deferred** until outbound email is wired.

### Roles + bootstrap admin

| Role / flag | Who | Can open |
| --- | --- | --- |
| `admin` | Global **app** admin | `/app/admin/*`; **`cms_access` on by default** → `/admin`; bypasses group ACL stubs |
| `member` | Default product user | App routes only (no Payload stub unless CMS access toggled on) |
| `cms_access` | Per-user switch on Users | Payload `/admin` via Better Auth session |
| User groups | Named sets under Users → Groups | Membership drives nav `group:<id>` visibility + ACL stub matrix |

### User groups + ACL foundation

**Users** hover submenu: **Accounts** · **Groups** · **ACL**.

| Piece | Role |
| --- | --- |
| **Groups** | Create / rename / delete; assign members. Only ACL entity (no separate Access Level table). |
| **ACL** | One matrix: grant admin-area permissions **to groups** (`sf_acl_permissions`). |
| **Nav / Layout / Page “Who can see”** | Multi-select tags (`public` / `registered` / `group:<id>`) on Nav items, layout particles, and Page Settings chrome. Visible if the viewer matches **any** tag; empty = public. Restricted pages hide (`notFound`). |

Global app admins still open all Core admin today; the matrix is the enforcement stub.

### Site Chrome + Site settings + Nav

**Site Chrome** (`/app/admin/site-chrome`, `sf_site_chrome`) is the top-level policy panel: site offline (+ message), default captcha stub, site metadata (name / description / OG image), robots meta + `/robots.txt`, content rights, cookie domain/path. Offline mode blocks public visitors; app admins still browse (banner) and can sign in via `/login`.

**Nav** is a **top-level** Core admin item (`/app/admin/nav`, sibling of Users / Site Chrome / Site settings / Layouts): multiple named **navigation sets** (menus) in `sf_nav_menus`, each with items (CMS page, URL, or module view; reorder; copy/paste; CSS class; browser/page title; multi-select access tags). Site Settings only **assigns** which set is the site primary header menu — not nested under Site Chrome.

One Payload global (`site-settings`) holds synced site name, `primaryNavMenuId`, capability flags, and module toggles. Core admins edit Modules at **`/app/admin/settings`**. CMS editors can edit the same document under Payload **Globals → Site settings** (legacy `primaryNav` array is a fallback only).

| Field | Default | What it does |
| --- | --- | --- |
| Site name | `Starforge` | Owned by Site Chrome; synced to Payload for header/legacy |
| Primary nav assignment | `main` | Which Nav menu set powers the public header (assignment only) |
| Registration | on | Hide `/register` + reject signup when off |
| Rich editor | on | Flag reserved for a future simpler mode (Lexical stays on Pages today) |
| Posts | **off** | Placeholder — no Posts collection yet |
| Modules | Site Settings → **Modules** list (incl. **Primary nav**); seed enables `notice-bar` | Off = hide from layout palette + skip public/atom inject; Primary nav off hides Nav admin + header links |
| Draft preview | **off** | When on, `cms_access` users can open `/preview/{slug}` for unpublished drafts |

`npm run seed` ensures the global exists, seeds Nav manager **Main** with About / Getting started / Welcome page binds, sets `primaryNavMenuId=main`, and enables the **notice-bar** module toggle. Flags are **product capabilities**, not npm libraries.

### Extension modules + Gantry-like layout manager

Public chrome is driven by a **layout document**: **sections → rows → slots** (`moduleId` + **`width` as %**). Storage is **JSON** in `sf_layouts` (fallback `default-layout.json`). Admin at **`/app/admin/layouts`** is **full width** and follows Gantry Layout Manager: create section → edit section **name** / **CSS classes** → add row → **drag** particles into the row (side-by-side; editable instance **display name**) → resize by **1%** steps (**5%–95%**, pair sums to 100%; Starforge flex math — **not Bootstrap**).

| Piece | Where |
| --- | --- |
| Register API | `registerModule()` · `src/core/modules/` |
| Built-in particles | `page-content`, `site-header`, `logo`, `copyright`, `social`, `custom` (HTML/CSS; JS stub) |
| Example extension | `src/modules/notice-bar/` |
| Catalog boot | `src/modules/catalog.ts` (+ builtins) |
| Layout document | `sf_layouts` rows (id + label + v3 JSON) · fallback `default-layout.json` |
| Outlines | `/app/admin/outlines` — create / rename / duplicate / select (opens Layout canvas) |
| Admin UI | `/app/admin/layouts?outline=<id>` |
| Public render | `PublicLayoutBody` + `SlotRenderer` (Page Settings `layoutId`) |

Default seed: Header → notice-bar (12); Navigation → site-header (12); Main → page-content (12); Footer → custom note (12). Docs: `src/core/modules/README.md`.

**Code editors:** Custom particle HTML/CSS/JS use **CodeMirror** (syntax highlighting + resizable panels) — not plain textareas. Monaco remains an option for a heavier Styles IDE later.

**Next polish (not this PR):** Gantry-like **Styles / Menu** editors; per-slot CSS/variations; outline inheritance; cross-row reorder; Custom JS execution + ACL; YAML export; nested menus; Redis on DO. See `src/core/modules/README.md` and [docs.gantry.org](https://docs.gantry.org/).

### Page Settings (document chrome)

Gantry-style **Page Settings** (Core admin nav: parent **Layouts** reveals a hover submenu — **Layout** default + **Outlines** + **Page settings**; parent click → Layout canvas; route **`/app/admin/page-settings`**): site defaults + per-page overrides (picker: global / home / CMS pages). Storage: JSON in **`sf_page_chrome`** (`global` row + slug/`home` overrides). Public layout merges **page → global**, then emits head meta/icons/CSS, body attrs/hooks, Font Awesome, ordered JS, and **atoms**. Styles / Particle Defaults join the same submenu later.

| Panel | Notes |
| --- | --- |
| Layout assignment | `layoutId` → any outline in `sf_layouts` + sections mode (fullwidth / boxed) + **Who can see** page viewing tags |
| Head Properties | Repeatable meta tags + custom head HTML |
| Assets | Favicon, touch icon, ordered CSS / JS lists |
| Body Attributes | Id, classes, tag attrs, after `<body>` / before `</body>` |
| Font Awesome | Optional CDN (6/7 Free) + advanced HTML overrides |
| Atoms | Registry (v1: Custom CSS/JS, Analytics); settings open in a **popup overlay** |

**ACL:** meta / classes / favicon / CSS URLs / FA enable = app admin. Custom head, body hooks, JS lists, atom scripts, FA HTML overrides = **developer-admin** (`STARFORGE_DEVELOPER_ADMIN_EMAILS`; empty list → all admins, local default).

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
- **Site settings** global defaults + **Nav manager Main** menu linked to those pages (`sf_nav_menus`)
- **Modules** feature enabled + **layout document v3** seeded into `sf_layouts` (notice-bar, site-header, page-content, custom footer)
- **Page Settings** global chrome defaults seeded into `sf_page_chrome`
- **Bootstrap app admin**: `admin@starforge.local` / `starforge-admin` → `admin` + `cms_access` + Payload stub
- **Demo app member**: `demo@starforge.local` / `starforge-demo` → `member`, **no** CMS access
- Promotes `STARFORGE_ADMIN_EMAILS` and grants them CMS access

### Edit pages in Payload admin (Lexical + SEO)

1. Sign in at **http://localhost:3000/login** as the seed admin, then open **http://localhost:3000/admin** (no second login).
2. **Media** → upload if needed (fill **Alt**).
3. **Pages** → edit a seeded page (Lexical + SEO tab).
4. **Publish** → open **http://localhost:3000/{slug}**. Drafts stay 404 for anonymous visitors.
5. **Draft preview (optional):** turn on **Draft preview** at `/app/admin/settings`, leave a page as draft (or edit a published page without publishing), then open **http://localhost:3000/preview/{slug}** while signed in with CMS access. Anonymous users still only see published `/[slug]`.

Public render: `src/app/(frontend)/(public)/[slug]/page.tsx` · `getPublishedPageBySlug` · `buildPageMetadata`.  
Draft preview: `src/app/(frontend)/(public)/preview/[slug]/page.tsx` · `getDraftPageBySlug` · `requireDraftPreviewAccess`.

### Windows: Nav manager (SF-40)

If Site Settings still shows **Site chrome → Primary nav** add/remove rows and the top bar has no **Nav** link, you are on old `main` — hard-reset onto this branch (stop `npm run dev` first).

**CMD**

```bat
cd %USERPROFILE%\starforge
git fetch origin
git checkout cursor/nav-manager-menus-541e
git reset --hard origin/cursor/nav-manager-menus-541e

docker compose up -d
if not exist .env copy .env.example .env
npm install
npm run db:core:push
npm run seed

rem Stop ANY old npm run dev window (Ctrl+C), then:
npm run dev
```

**PowerShell**

```powershell
cd $env:USERPROFILE\starforge
git fetch origin
git checkout cursor/nav-manager-menus-541e
git reset --hard origin/cursor/nav-manager-menus-541e

docker compose up -d
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm install
npm run db:core:push
npm run seed

# Stop ANY old npm run dev window (Ctrl+C), then:
npm run dev
```

1. Admin bar must show **Users | Site Chrome | Site settings | Nav | Layouts** (Nav is top-level).
2. **/app/admin/site-chrome** — offline, metadata, robots, rights, cookies. **/app/admin/settings** — **Primary nav assignment** + Modules (no nav item editor).
3. **/app/admin/nav** — edit Main menu items (CMS page / URL / **module view**, CSS class, title overrides, Up/Down, Copy/Paste). Module views come from enabled Modules catalog entries that declare `navViews`.
4. Modules → Primary nav on/off gates the Nav link + public header.
5. Public **/about** — matching nav active.

### Windows: published content cache smoke test

```bat
cd %USERPROFILE%\starforge
git fetch origin
git checkout cursor/published-content-cache-8a53
git pull origin cursor/published-content-cache-8a53

docker compose up -d
if not exist .env copy .env.example .env
npm install
npm run db:core:push
npm run seed

rem Stop ANY old npm run dev window (Ctrl+C), then:
npm run dev
```

1. Open **http://localhost:3000/about** (anonymous) — sample published page.
2. Sign in → `/admin` → Pages → edit **About**, change the title, **Publish**.
3. Hard-refresh **http://localhost:3000/about** — new title should show (cache tag revalidated on publish).
4. Unpublish (save as draft) → anonymous `/about` must **404**.
5. `/preview/about` with Draft preview on still works for CMS-access users (uncached path).

Leave `STARFORGE_CONTENT_CACHE` unset locally. Redis is for DigitalOcean later.

### Windows: draft preview smoke test

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

rem Stop ANY old npm run dev window (Ctrl+C), then:
npm run dev
```

1. Open **http://localhost:3000** (not `127.0.0.1`).
2. Sign in at `/login` as `admin@starforge.local` / `starforge-admin`.
3. `/app/admin/settings` → enable **Draft preview** → Save.
4. `/admin` → Pages → create or edit a page, leave it as **Draft** (do not publish), note the slug.
5. Open `http://localhost:3000/preview/{slug}` — should show the draft with a preview banner.
6. Open `http://localhost:3000/{slug}` while signed out (or in a private window) — must **404**.
7. Turn **Draft preview** off → `/preview/{slug}` must **404** even when signed in with CMS access.

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
    (frontend)/             # public app shell + /login + /register + /[slug] + /preview/[slug]
      (public)/             # site header + ModuleSlots (header / after-content / footer)
      app/admin/            # core app admin (users/groups + settings + nav + layouts + CMS bridge)
    (payload)/              # Payload admin + REST/GraphQL (do not hand-edit)
    api/auth/               # Better Auth handler
    api/health/             # core health route
    api/me/                 # current app session
  collections/              # Payload content collections (Pages, Media, Users)
  globals/SiteSettings.ts   # site name, primaryNavMenuId, feature toggles, modules
  components/               # SiteHeader + SiteNav + RichText (Lexical → JSX)
  modules/                  # extension modules (notice-bar) + catalog register
  core/
    auth/                   # Better Auth + roles/admin helpers + Zod schemas
    cms-bridge/             # cms_access + Payload session strategy (one login)
    content/                # published + draft CMS reads, cache layer, preview gate, SEO
      cache/                # Next tags (default) + Redis stub for DO
    nav/                    # Nav manager (sf_nav_menus) store + resolve + actions
    acl/                    # User groups + ACL stub (sf_user_groups, sf_acl_permissions)
    modules/                # register API, layout document, ModuleSlot, PublicLayoutBody
    settings/               # site-settings + legacy nav resolve + flag helpers
    db/                     # Drizzle core schema + client (sf_layouts, sf_nav_menus, groups, …)
  fields/pagesLexical.ts    # Lexical editor features for Pages
  seed.ts                   # pages + settings + layout + modules on + bootstrap admin + demo member
  payload.config.ts         # Payload config (content module)
```

### Windows: layout manager smoke test

Command Prompt:

```bat
cd %USERPROFILE%\starforge
git fetch origin
git checkout cursor/layout-editable-labels-f0de
git pull origin cursor/layout-editable-labels-f0de

docker compose up -d
if not exist .env copy .env.example .env
npm install
npm run db:core:push
npm run seed

rem Stop ANY old npm run dev window (Ctrl+C), then:
npm run dev
```

PowerShell:

```powershell
cd $env:USERPROFILE\starforge
git fetch origin
git checkout cursor/layout-editable-labels-f0de
git pull origin cursor/layout-editable-labels-f0de

docker compose up -d
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm install
npm run db:core:push
npm run seed

# Stop ANY old npm run dev window (Ctrl+C), then:
npm run dev
```

1. Open **http://localhost:3000** — notice bar in the header (Modules on from seed).
2. Sign in as `admin@starforge.local` / `starforge-admin`.
3. Open **http://localhost:3000/app/admin/layouts** — page is **full width**; left palette + canvas.
4. Edit a section **name** and **CSS classes** (blur to save); confirm classes appear on the public section wrapper.
5. Create a section → **Add row** → **drag** Notice bar (or Custom) into the row; edit the particle **display name** (type id unchanged).
6. Drag a second particle into the same row — both sit **side by side**; drag the divider (1% steps, 5%–95%, sum 100%).
7. Drag a particle’s **⋮⋮** handle to **reorder** within the row (order persists; widths stay).
8. Drag **Logo / Image**, **Copyright**, and **Social** from the palette — **Settings** opens a floating overlay (row stays side-by-side). Save and confirm public render.
9. Edit Custom via its Settings overlay (CodeMirror); Escape / outside click closes. **Reset to default** restores the seeded layout.

## Not in this scaffold

- Production / DigitalOcean deploy (including Redis — cache interface is ready; backend not wired)
- Forgot / reset password (needs email — deferred), OAuth
- Second Payload password login (removed — Better Auth session strategy only)
- Posts collection
- Full Gantry Styles / Outlines / Menu editors, cross-row reorder, YAML mode, Custom JS execution + ACL, Payload media picker for Logo (layout DnD canvas + typed Logo/Copyright/Social + CodeMirror Custom + JSON storage are in)
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
