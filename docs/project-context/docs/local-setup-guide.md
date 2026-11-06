# Starforge — local setup guide (first time)

You are new to React + Node + PostgreSQL. Follow this in order. Do not skip ahead to DigitalOcean.

## What you will end up with

- **Node.js** — runs the Starforge web app (React/Next.js + Payload)
- **PostgreSQL** — database (via Docker, so you do not install Postgres by hand)
- **Docker Desktop** — runs Postgres (and later Redis if needed) in one command
- The **starforge** git repo on your machine, with a runnable local env

## Phase A — Install tools on your computer (once)

### A1. Git
- macOS: `xcode-select --install` or install from https://git-scm.com
- Windows: https://git-scm.com/download/win
- Check: `git --version`

### A2. Node.js 22 LTS (or current LTS)
- https://nodejs.org — choose LTS
- Starforge expects Node **`^22.23.4`** (or Node 24+)
- Check: `node -v` and `npm -v`

### A3. Docker Desktop (Windows)
- Download: https://www.docker.com/products/docker-desktop/
- Install **Docker Desktop for Windows**. If asked, allow WSL 2 / virtualization.
- Reboot if the installer asks.
- Start **Docker Desktop** from the Start menu and wait until the whale icon shows **Running** (not “Starting…”).
- **Close and reopen** Command Prompt (PATH only updates in new windows).
- Check: `docker version` and `docker compose version`
- If `docker` is still “not recognized”: Docker Desktop → Settings → General → ensure it’s running; sign out/in or reboot once.

### A4. A code editor
- Cursor (you already have it) opened on the starforge folder

## Phase B — Get the project

```bash
git clone https://github.com/seraxes/starforge.git
cd starforge
```

(If the scaffold PR is not merged yet, check out that branch instead of `main`.)

## Phase C — Start the database

Always run from the project folder (`…\starforge`). If the prompt shows only `C:\Users\…>`, run `cd %USERPROFILE%\starforge` first.

From the project root:

```bash
docker compose up -d
```

This starts PostgreSQL (`starforge-postgres` on port **5432**). Leave Docker running while you develop.

Check: `docker compose ps` should show Postgres **healthy**.

The Compose init script creates a Postgres schema named **`payload`** for CMS tables. Starforge core tables use the default **`public`** schema.

## Phase D — App env + install

```bash
cp .env.example .env
npm install
```

`.env.example` already matches Compose:

- `DATABASE_URL=postgresql://starforge:starforge@127.0.0.1:5432/starforge`
- `PAYLOAD_SECRET=…` (change before any shared use)

Edit `.env` only if you changed Compose ports or credentials.

### Optional — choose modules (Module Manager)

Default `starforge.modules.json` flavor is **`core`** (full local catalog). For a lean site:

```bash
# Interactive: pick packs, then sync + generate
npm run modules:wizard

# Or set "flavor": "lean" in starforge.modules.json, then:
npm run modules:sync
```

Three layers: **sync** (which `@starforge/module-*` packages are installed) → **generate** (registry codegen) → **Site Settings → Modules** (runtime on/off). Details: [module-install-packages](./module-install-packages.md).

## Phase E — Run Starforge locally

```bash
npm run dev
```

Next 16 defaults to **Turbopack**. If a new admin route throws `ENOENT …/build-manifest.json` after a cache clear, use the webpack fallback:

```bash
npm run dev:webpack
```

Open:

| URL | What |
| --- | --- |
| http://localhost:3000 | Starforge frontend shell |
| http://localhost:3000/admin | Payload admin (create the first CMS editor on first visit) |
| http://localhost:3000/api/health | Core health JSON — expect `"database":"up"` |

Optional later: `npm run db:core:push` when you start using Starforge core Drizzle tables (`sf_users`).

## Phase F — What “done for local” means

- App starts without errors
- You can open the site and the Payload admin
- `/api/health` reports the database up
- Postgres data survives `docker compose restart`

## Not yet

- DigitalOcean / live servers
- Full Airsoftnexus 2.0 (ASN 2.0) feature parity — that comes after the core runs locally

## If something fails

1. Is Docker Desktop running?
2. Is port 5432 or 3000 already used? Stop the other app or change the port in Compose / `npm run dev -- -p 3001`
3. Fresh DB missing the `payload` schema? Recreate the volume: `docker compose down -v && docker compose up -d`
4. Copy the exact terminal error into this Project chat

## Coordinator checkpoints

Tell the Project coordinator when you finish each phase (A / B / C / D / E) so the next step can be adjusted.
