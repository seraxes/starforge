# Starforge

Lean, reusable **website core toolkit** — not a full CMS. Starforge gives you the basics every product site needs (auth, users, profiles, transactional email) so product apps can stay focused on domain features.

Built to be consumed by sites like ASN 2.0 later. Keep this repo **product-agnostic**: no marketplace, no plugin/extension platform, no product-specific modules.

## Layout

npm workspaces monorepo:

```
apps/
  api/          # Fastify + TypeScript + PostgreSQL (Drizzle)
  web/          # React + Vite + TypeScript (skeleton consumer UI)
packages/
  shared/       # Shared API contracts / DTOs
```

Intentionally small surface. Add modules later only when multiple products need them.

## Auth approach

**JWT access tokens + opaque refresh tokens** (stored hashed in Postgres):

| Piece | Behavior |
| --- | --- |
| Access JWT | Short-lived (`JWT_ACCESS_TTL`, default 15m). Sent as `Authorization: Bearer …`. |
| Refresh token | Opaque random string, SHA-256 hashed in `refresh_tokens`. Rotated on each `/auth/refresh`. |
| Logout | Revokes the presented refresh token. |

Why this combo: works for SPAs and native clients, supports server-side revocation, and avoids sticky session stores. Cookie sessions remain an option later if a product prefers them.

## Domains (stubs that compile)

- **Auth** — register / login / refresh / logout / me
- **Users** — list (admin), get by id, set role (admin)
- **Profiles** — get/update own profile, public get by user id
- **Email** — `EmailTransport` interface + `console` (dev) and `smtp` transports

## Prerequisites

- Node.js 20+
- Docker (for local Postgres) *or* any PostgreSQL 16+ instance

## Quick start

```bash
# 1. Install
npm install

# 2. Env
cp .env.example .env

# 3. Database
docker compose up -d
npm run db:migrate

# 4. Run API + web (separate terminals)
npm run dev:api
npm run dev:web
```

- API: http://localhost:3001  
- Health: http://localhost:3001/health  
- Web: http://localhost:5173  

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev:api` / `dev:web` | Start API or web in watch mode |
| `npm run build` | Build shared → api → web |
| `npm run typecheck` | Typecheck all workspaces |
| `npm run lint` | Same as typecheck for now (tsc) |
| `npm run db:generate` | Generate Drizzle migrations from schema |
| `npm run db:migrate` | Apply migrations |

## Environment

See [`.env.example`](./.env.example). Important vars:

- `DATABASE_URL` — Postgres connection string
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — min 32 chars each
- `CORS_ORIGIN` — web origin(s), comma-separated
- `EMAIL_TRANSPORT` — `console` (default) or `smtp`
- `VITE_API_URL` — API base URL for the web app (empty = same-origin / Vite proxy)

## Architecture intent

Starforge is the **reusable core** layer. Product repos (e.g. ASN 2.0) depend on it and own domain features (events, social, monetization, etc.). Prefer pragmatic services and clear boundaries over a plugin marketplace or Joomla-like extensibility.

## License

UNLICENSED / private — adjust when publishing policy is decided.
