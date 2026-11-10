# Starforge — core CMS build plan

**Historical roadmap (refreshed 2026-11-02).** Do not use it as the queue or as the Payload/media split. Live map: [architecture-current](./architecture-current.md).

Practical roadmap for Starforge as a reusable CMS / starter platform. Aimed at someone new to React, Node, and PostgreSQL. Ship small, testable slices locally.

**ASN 2.0 (Airsoftnexus 2.0)** is a later product on Starforge. This plan is **core platform first** — not an ASN feature dump.

**Refresh (2026-11-02):** Aligned to shipped Core on `main` (through media [#49](https://github.com/seraxes/starforge/pull/49) and remount [#48](https://github.com/seraxes/starforge/pull/48)). Sources: [track audit](./starforge-track-audit.md), [replaceable modularity](./replaceable-modularity-plan.md), [media pipeline](./media-pipeline-plan.md), preferences + [modular-core](../principles/modular-core.md).

---

## 1. Vision

Starforge is an owned, extendable **core CMS / starter platform** for ordinary web projects: marketing sites, brochure apps, membership-style apps, and similar. Target ~**70%** shared platform; ASN (later) keeps domain logic and special modules.

**Build direction:** vertical slices — each PR ships the smallest backend *and* the UI that uses it.

- **Core** owns auth, app users/groups/ACL, app shell, Site Chrome, Nav, Layouts/Outlines/Page Settings, Forms, extension points (Next.js + Drizzle + PostgreSQL).
- **Payload** owns editorial page bodies (Lexical) and **one** Media library (schema `payload`, same Postgres). Swappable *in principle* via bridge — not a second live CMS.
- **Feature modules** = Site Settings on/off (+ later install allowlist). **Infrastructure ports** = thin adapters (cache, email, captcha verify, media storage).
- Prove everything **locally** first. DigitalOcean comes much later (after core + most ASN functions exist).
- One engine per concern (Form, media, layout). No parallel builders or media stores.

Inspiration: Joomla-like breadth + Gantry-like layout, on Zoltán’s terms.

---

## 2. What we already have (shipped Core on `main`)

Runnable locally with Docker Compose + `npm run dev`. Scaffold landed via SF-4 / SF-7 ([PR #2](https://github.com/seraxes/starforge/pull/2)); product Core grew through SF-13 and related tasks.

| Area | Status |
| --- | --- |
| **Stack** | Next App Router + Better Auth/Drizzle (`sf_*` in `public`) + Payload 3 (`payload` schema) + Postgres 16 |
| **Auth** | Cookie sessions, register/login/logout, roles; **one login** → Payload via `cms-bridge` / `/api/cms/exchange` (no second password) |
| **Users / ACL** | Core user admin; **groups only** (no Access Levels); viewing tags on nav / particles / Page Settings (ANY match; empty = public) |
| **Site Chrome** | Offline → 503, default captcha policy, site metadata/robots, cookies; SEO inheritance |
| **Site Settings** | Feature flags + **Modules** runtime on/off (gates admin nav + public slots) |
| **Nav manager** | Multiple menus, items DnD/copy, bind pages/URLs, who-can-see tags ([#47](https://github.com/seraxes/starforge/pull/47)) |
| **Layout (Gantry-like)** | Sections/rows/particles, outlines, canvas styles + breakpoints, Page Settings chrome; typed particles (Logo/Menu/Copyright/Social/Custom/`page-content`) |
| **Form engine** | One Core Form (dnd-kit + JSON/Zod); conditional + math; Layout-like builder; Contact preset; other presets = stubs by design ([modular-core](../principles/modular-core.md)) |
| **Public content** | Published Payload pages via cached `getPublishedPageBySlug` → layout `page-content` (no hard-coded `.home` scaffold); draft preview |
| **Media** | Payload Media + Starforge pipeline/UI ([#49](https://github.com/seraxes/starforge/pull/49)): folder/purpose, resize/WebP (PNG logos kept), Core `/app/admin/media`, `MediaPicker` on Logo / Styles / Form options; local storage + S3 stub |
| **Admin integrity** | Remount keys on Page Settings / Layout / Styles/Breakpoints ([#48](https://github.com/seraxes/starforge/pull/48)); autosave + Saved toast; captcha `server-only` split |
| **Local DX** | Compose Postgres, `/api/health`, seed, `.env.example`, README + [local setup guide](./local-setup-guide.md) |

**Still open (not “missing scaffold” — next platform work):** install/build module allowlist; Redis + email port implementations; password reset (needs email); dark public theme toggle; richer Form presets; Spaces/S3 adapter; DO hosting; ASN 2.0.

---

## 3. Feature inventory (core CMS)

Phases: **Done** = on `main`; **P1** = next product/platform depth; **P2** = harden / reuse; **Later** = DO / ASN.

### Auth & users (core)

| Feature | Why | Phase |
| --- | --- | --- |
| Password signup / login (app users) | Core owns product accounts | Done |
| Secure sessions (Better Auth + cookie) | Hot-path auth off Payload Local API | Done |
| Logout + session/“who am I” | App shell wiring | Done |
| One login → Payload CMS access | No second password; bridge + CMS toggle | Done |
| Roles (admin / editor-app / member) thin gate | Platform gate; groups carry membership ACL | Done |
| Global admin = core + Payload | Full platform reach | Done |
| Admin user list / disable | Operate without raw SQL | Done |
| Groups + viewing tags + ACL matrix | Groups only — not Access Levels | Done |
| Password reset / forgot username | Needs email port first | P1 (after email) |
| Optional OAuth | Common ask; not required | P2 |
| Audit log of auth events | Multi-site / shared core later | P2 |

### Content model (Payload module)

| Feature | Why | Phase |
| --- | --- | --- |
| Pages + Lexical editor | Editorial body + modern writing surface | Done |
| Page SEO fields + seed | Shareable metadata; clickable demo site | Done |
| Public render by slug + 404/draft rules | Content reaches the public site | Done |
| Draft preview | Check before publish | Done |
| Published content cache path | Anonymous traffic off raw Payload chatting | Done (Next default; Redis stub) |
| Nested pages / richer nav chrome | Menus already exist; deeper page tree optional | P1 / P2 |
| Reusable blocks beyond Lexical | Avoid one-off page shapes | P2 |
| Extra collections (e.g. Posts) | Prove module pattern; Site Settings flag exists | P2 |
| Versions / restore UX docs | Safe draft → publish loop | P1 |

### Media

| Feature | Why | Phase |
| --- | --- | --- |
| One Payload Media library | Single store; features tag/ACL/filter | Done |
| Folders / purpose + Core admin browser | Library UX around Payload | Done ([#49](https://github.com/seraxes/starforge/pull/49)) |
| Resize / JPEG quality / WebP (PNG logos kept) | Responsive without hand-resizing | Done |
| Bind Logo / Styles / Form options via `mediaId` | Retire raw URL as primary | Done (SF-66) |
| Mobile / camera-friendly upload | Device capture in Core media UI | Done (foundation) |
| Richer ACL / per-feature media tags | Beyond folder + purpose | P2 |
| Object storage adapter (S3/Spaces) | Port stubbed; implement pre-DO | Later (port) |

### Layout / chrome / admin UX

| Feature | Why | Phase |
| --- | --- | --- |
| Gantry-like visual layout manager | Core owns assembly, not Payload-only | Done |
| Outlines + Page Settings + styles/breakpoints | Document chrome + outline-scoped styles | Done |
| Typed particles + Custom escape hatch | Config JSON; Menu binds Nav set | Done |
| Site Chrome + Nav manager + Site Settings | Split chrome / menus / toggles cleanly | Done |
| Core admin Gantry dark chrome | Full-width, left sidebar, autosave UX | Done |
| Remount keys (no cross-target autosave) | Integrity for draft editors | Done ([#48](https://github.com/seraxes/starforge/pull/48)) |
| Monaco/CodeMirror for CSS/JS/HTML fields | Better than Gantry plain textareas | P1 / P2 |
| Tailwind + shadcn polish; Payload/Core seam | Shared tokens when polishing | P2 |
| Optional dark *public* theme toggle | Pastel blue/orange dark; admin already dark | P1 (SF-33) |

### Forms

| Feature | Why | Phase |
| --- | --- | --- |
| One Form engine + Layout-like builder | Contact → survey/events/voting/tickets as presets | Done (foundation) |
| Conditional + mathematical logic | Real forms without a second stack | Done |
| Contact preset + Turnstile wiring | First product path; secrets in env | Done |
| Survey / event / voting / ticket presets | Seeds on same engine — not parallel builders | P1 / P2 |
| Form success email harden | Needs Mailer port | P1 (with email) |

### Extensions / modules

| Feature | Why | Phase |
| --- | --- | --- |
| `registerModule` + particles + notice-bar example | Extend without forking core | Done |
| Site Settings module toggles (runtime) | Hide UI + skip public render | Done |
| `starforge.modules.json` allowlist + generated registry | No deadweight — toggles alone are not enough | **P1 (clear next)** |
| `@starforge/module-*` + `modules:sync` (GitHub Packages) | Lean vs ASN image flavors | P2 |
| Core event hooks (user.created, page.published) | Modules react without editing core | P2 |

### Security / ops

| Feature | Why | Phase |
| --- | --- | --- |
| Env secrets discipline | Never Site Settings / Chrome / DB | Done / ongoing |
| Local Compose + health + seed | Day-one DX | Done |
| Cookie `secure`, Payload CSRF | Prod hardening | Later (pre-DO) |
| Redis published-content (and later sessions/queues) | Port behind existing cache interface | **P1 port** |
| Email `Mailer` port | Forgot password + form mail | **P1 port** |
| Rate limits / security headers / CI scanning | Harden before shared hosting | P1–P2 |
| Drizzle migrations (not only push) | Safer schema evolution | P1 |
| DigitalOcean topology | Context exists; not this track | **Later** |

### Multisite / tenancy

| Feature | Why | Phase |
| --- | --- | --- |
| Single-site assumption | Keep work simple | Done (documented practice) |
| Tenant isolation | Only if a second project needs it | P2 / Later |

---

## 4. Phased plan — from here

P0 local CMS slices (auth → Lexical → public pages → nav → layout → forms → chrome → media → remount) are **complete**. Work below is ordered for the next merges.

### Clear next (do these; hold the rest)

1. **Module allowlist (P1)** — `starforge.modules.json` (or `SF_MODULES`) → generated `module-registry.ts` + dynamic import boundaries so disabled packs are not eager-imported. Complements runtime toggles ([module-toggle-architecture](./module-toggle-architecture.md), [replaceable-modularity-plan](./replaceable-modularity-plan.md)). Required platform entries stay non-disableable.

2. **Infrastructure ports (thin)**  
   - **Redis** — implement `createRedisPublishedContentCache` behind the existing published-content cache interface; local stays Next/in-memory.  
   - **Email** — small `Mailer` port (console/dev → SMTP/API); then forgot-password / form success mail (SF-17).  
   Captcha stays provider enum + server-only verify; secrets in env only.

3. **Hold ASN (SF-8)** — no Airsoftnexus domain modules until allowlist + media depth are real. Keep Form presets as seeds on the one engine.

4. **DigitalOcean later** — no droplet/VPC/TLS work on this track. When approaching DO: cookie `secure`, Payload CSRF, Redis adapter live, Spaces/S3 media storage adapter, then [project context](./project-context.md) hosting layout (SF-6).

### P1 — deepen platform (after / alongside allowlist + ports)

5. Password reset + forgot username once Mailer exists (SF-17).  
6. Optional dark public theme (SF-33).  
7. Form presets beyond contact (survey/event/voting/ticket) as typed extensions — same builder.  
8. Drizzle migrations + minimal smoke (health + login + page + one admin save).  
9. Syntax-highlighted CSS/JS/HTML editors where Page Settings / Custom allow it.

### P2 — harden for reuse (still local-first)

10. Richer blocks / Posts collection; media ACL/tags beyond folder/purpose.  
11. Module packages + `modules:sync`; optional event hooks.  
12. Rate limits, security headers, CI secret/dep scanning.  
13. Tailwind/shadcn polish; Payload ↔ Core admin visual seam.

### Layout / media notes (already mostly shipped)

- **Layout:** YAML/JSON under the hood is fine; visual editor is primary. Any registered module in any position. Custom JS = developer-admin only. Continue improving chrome; do not rebuild a second layout stack.
- **Media:** Pipeline foundation + library binds shipped in [#49](https://github.com/seraxes/starforge/pull/49). Remaining = richer ACL/tags and real Spaces/S3 when hosting nears — see [media-pipeline-plan](./media-pipeline-plan.md).

---

## 5. Out of scope for now

- DigitalOcean droplets, VPC, TLS, backups, PgBouncer (**Later**)  
- Full **ASN 2.0** domain features (games, marketplace, shop, stream, chat, friends, ASN ACL policies) — **hold**  
- Parallel Form builders or a second media store  
- Replacing Payload or Better Auth “just in case” dual adapters  
- Multi-tenant SaaS CMS positioning vs Sanity/Contentful  
- Production object storage / Redis until ports are wired and DO is near  

---

## 6. Recommended next PR

**Preferred next build:** `starforge.modules.json` allowlist + generated registry (no deadweight).

**Slice (one PR):**

1. Catalog file listing installed/allowed module ids (platform entries fixed).  
2. Codegen (or checked-in generated) `module-registry.ts` that only imports allowlisted modules.  
3. Stop eager `ensureModulesRegistered()` imports for optional Form/Notice (and future packs).  
4. Site Settings Modules list continues to toggle *installed* modules only.  
5. Short README: allowlist vs runtime toggle ([replaceable-modularity-plan](./replaceable-modularity-plan.md)).

**Why this next:** track audit — runtime toggles alone fail “no deadweight”; media + remount integrity just landed; allowlist unlocks lean Core before more optional modules or ASN pressure.

**Parallel / immediately after:** thin Redis cache adapter + Mailer port stubs/implementations (env-selected), without expanding product surface.

**Alt:** SF-17 forgot-password *after* Mailer exists; SF-33 dark public theme if polish matters more than packaging this week.

---

## 7. Recommended libraries / building blocks

Prefer mature libraries; swap only with a clear reason.

| Area | Recommendation | Notes |
| --- | --- | --- |
| Core auth | **Better Auth** (locked) | Cookie sessions + Postgres/Drizzle; bridge Payload — do not dual-stack |
| ORM / SQL | **Drizzle** (already) | Core `sf_*` in `public` |
| Validation | **Zod** | Shared request/form schemas; Form engine evaluate path |
| Content / media CMS | **Payload 3** (already) | Editorial + one Media library |
| Rich editing | **Payload Lexical** | Shipped |
| DnD / builders | **dnd-kit** | Layout + Form canvases |
| UI primitives (later polish) | Tailwind + shadcn/ui + Radix | After foundation; migrate tokens carefully |
| Email | **Mailer port** → Nodemailer local / Resend (or SMTP) | Introduce before password reset |
| Cache | **PublishedContentCache** → Next now, **Redis** adapter next | Design already stubbed |
| Jobs / queues (later) | **BullMQ** + Redis | Only when background work appears |
| Object storage | **MediaStorage** local now; S3/Spaces later | Via port when leaving disk |
| Testing | **Vitest** + Playwright smoke | Health + login + page + admin save |

**Avoid:** Passport legacy patterns, Prisma (second ORM), SurveyJS (parallel form stack), second media DB, heavy admin kits that fight Payload, Mongo, putting secrets in Site Settings/Chrome/DB.
