---
kind: reference
last_verified: 2026-11-22
---
# Admin tour

Moved from the root README (slice D6). Local URLs and Core admin surfaces after `npm run seed` + `npm run dev`.

Sign in at `/login` with the **development-only** seed account (`admin@starforge.local` / `starforge-admin`) or an email listed in `STARFORGE_ADMIN_EMAILS`. Never use seed credentials on a deployed site.

## Local URLs

| URL | What |
| --- | --- |
| http://localhost:3000 | App shell |
| http://localhost:3000/register | Create a core app account (default role `member`) |
| http://localhost:3000/login | Sign-in (Better Auth) |
| http://localhost:3000/forgot-password | Password reset request |
| http://localhost:3000/forgot-username | Sign-in email reminder |
| http://localhost:3000/account/security | 2FA / recovery codes |
| http://localhost:3000/admin | Core admin Dashboard |
| http://localhost:3000/admin/users | Accounts (roles, groups, disable) |
| http://localhost:3000/admin/users/groups | User groups |
| http://localhost:3000/admin/users/acl | ACL matrix |
| http://localhost:3000/admin/site-chrome | Site Chrome (offline, metadata, robots, email, captcha) |
| http://localhost:3000/admin/site-chrome/environment | Developer-admin env editor (writes `.env.local`) |
| http://localhost:3000/admin/settings | Modules on/off + primary nav assignment |
| http://localhost:3000/admin/nav | Nav manager |
| http://localhost:3000/admin/forms | Forms definitions + builder |
| http://localhost:3000/admin/email | Email Manager |
| http://localhost:3000/admin/redirects | Redirects (+ CSV import) |
| http://localhost:3000/admin/media | Media library |
| http://localhost:3000/admin/layouts | Layout canvas |
| http://localhost:3000/admin/page-settings | Page Settings chrome |
| http://localhost:3000/admin/pwa | PWA settings (opt-in module) |
| http://localhost:3000/api/me | Current session JSON |
| http://localhost:3000/api/health | Health JSON (`database: "up"` when Postgres is up) |
| http://localhost:3000/robots.txt | Robots snippet |
| http://localhost:3000/sitemap.xml | Published pages sitemap |
| http://localhost:3000/preview/{slug} | Draft preview (`cms_access` + Draft preview toggle) |

Locale-prefixed public routes negotiate via next-intl (`/en`, `/hu`, …).

## Roles

| Role / flag | Who | Can open |
| --- | --- | --- |
| `admin` | Global app admin | `/admin/*`; `cms_access` on by default |
| `member` | Default product user | App routes; Core admin only with group ACL grants |
| `cms_access` | Per-user switch on Users | Page editing / draft preview |
| User groups | Users → Groups | Nav visibility tags + ACL matrix |

## Site Chrome + settings + Nav

**Site Chrome** (`/admin/site-chrome`): offline mode, captcha defaults, outbound email enable/provider/From, metadata, robots, cookies. **Environment** is developer-admin gated and writes allowlisted keys to `.env.local` (never Postgres). Production env editor is read-only unless `STARFORGE_ENV_EDITOR=write`.

**Nav** (`/admin/nav`): named menus in `sf_nav_menus`. Site Settings only **assigns** the primary header menu.

**Forms** (`/admin/forms`): definitions + visual builder; place the Form particle on a layout. Captcha follows Site Chrome when the form opts in.

**Email Manager** (`/admin/email`): rules + templates; modules emit via `emitEmailTrigger`. Transport stays Core Mailer + env secrets.

**Redirects** (`/admin/redirects`): `from` / `to` / status; CSV import `from,to,status,enabled,note`.

**Layouts** (`/admin/layouts`): sections → rows → slots with % widths. **Page Settings** (`/admin/page-settings`): Head / Assets / Body / Font Awesome / Atoms. Script-capable fields need `STARFORGE_DEVELOPER_ADMIN_EMAILS` in production.

## Module install vs runtime

| Layer | Effect |
| --- | --- |
| `starforge.modules.json` + `npm run modules:sync` | Install/remove package deps |
| `modules:generate` (or `SF_MODULES`) | Build allowlist → `src/generated/module-registry.ts` |
| Site Settings → Modules | Runtime on/off for installed packs |

See [module-install-packages](../project-context/docs/module-install-packages.md).

## Seed contents (local)

Idempotent demo data from `npm run seed`: sample published pages, Nav **Main**, layout document, Page Settings defaults, bootstrap admin + demo member, promotes `STARFORGE_ADMIN_EMAILS`. Production seed is blocked unless `STARFORGE_ALLOW_PRODUCTION_SEED=1`.
