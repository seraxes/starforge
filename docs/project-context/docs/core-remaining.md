# Starforge Core — what remains

**Not the live queue.** Dashboard D2–D4, the email send log, Forms/Security/Performance cards, and module info pages shipped after the lists below (SF-226–SF-230). Events, Maps, Profiles, and Payments are real packs, not stubs. What is still open in Core, and the decision to finish that before the next pack: [architecture-current](./architecture-current.md).

**Scope:** Core only (not heavy Modules / Hero).  
**Sources:** [core-gaps-evaluation](./core-gaps-evaluation.md) (Nov 4 — **stale on P0–M5**), [admin-dashboard-gap](./admin-dashboard-gap.md), [preferences](../preferences.md), [notes](../notes.md) Done vs Queued (through SF-223 / #135).  

**Verdict at the time:** Opus called the Core spine “done enough” to start modules. That bar is withdrawn (2026-11-10). Finish the remaining Core host work before the next pack. Do not treat the shipped security slices as permission to skip Particle Defaults, the core glance, or the engine extract.

---

## Done enough

Security + boundary blockers from the Nov 4 eval are shipped (notes Done):

| Slice | Evidence |
| --- | --- |
| RateLimiter + trusted client IP | SF-182 #107 |
| Developer-admin fail-closed + site-settings ACL | SF-183 #109 |
| Captcha → `core/security` | SF-184 #111 |
| Manifest M1–M2 (nav / particle host / route shims / `sf_module_settings`) | SF-185 #112, SF-198 #119 |
| BA `trustedOrigins` + Redis secondaryStorage | SF-192 #113 |
| Redis invalidate await + layout/cache proxy | SF-193 #114 |
| ACL matrix UI (groups admin rights) | SF-194 #115 |
| Form presets (survey / event-registration / voting) | SF-195 #116 |
| Media Phase 3 + toggleable pack M5 | SF-196 #117, SF-197 #118 |
| Email Manager (pref: before heavy Modules) | SF-204–207 #121–123 |
| Admin Dashboard host + Users real widgets + soft card shells | SF-212–215, SF-214, SF-221 #127–130, #134 |
| Admin `/admin` vs Payload `/cms` | SF-213 #128 |
| Spine before that | Auth, Layout/Nav/Chrome, Forms+upload, Media 1–2, Redis cache, CSP/csrf, Consent, redirects/sitemap, search/taxonomy, migrations+CI, env validate, M0 |

Core freeze for **starting** carefully designed product Modules is open; remaining Core work is polish, not a gate on security/boundary.

---

## Thin leftovers

Ordered for Core densification (skip Events/Marketplace *data* — those packs are deferred stubs only).

| # | Item | Size | Notes |
| --- | --- | --- | --- |
| 1 | **Dashboard D2 — Media aggregates** | S–M | Wire `loadMediaCountsStats`; card chrome exists |
| 2 | **Dashboard D4 — soft refresh** | S | Poll/`router.refresh` from `dashboardRefreshIntervalSec` |
| 3 | **Dashboard D3 — Email send log + `email.sent`** | M then S | Needs durable sends table on Mailer success |
| 4 | **Wire stub Core/module cards** | S–M | Real `forms.submissions`, `security.posture`, `performance.glance` (data mostly exists) |
| 5 | **Core glance pack** | M | `system.health`, chrome/robots/captcha posture, `modules.summary` |
| 6 | **Needs-attention rail** | M | Offline / Mailer off / health / env warnings |
| 7 | ~~**Modules list → info/settings**~~ | ~~M series~~ | **Shipped SF-230** — Core host `/admin/settings/modules/<id>`; Modules rows link Info/Settings (reuse Media/Forms Settings; soft stubs otherwise) |
| 8 | **Particle Defaults depth** | S–M | Layouts tab still stub |
| 9 | **Form dual-schema / M3–M4 extract** | M | Engines still partly Core-hosted; not blocking pack consumers |
| 10 | **Consent category UI; redirect CSV** | S | Nice-to-have from eval |
| 11 | **Mailer transactional templates** | S–M | Shared templates beyond Email Manager rules |
| 12 | **Dynamic admin theme CSS import** | S | Env registry works; layouts still static gantry import |
| 13 | **Doc hygiene — refresh gaps eval** | S | Queued **SF-199** (this doc + Done stack supersede Nov 4 P0 list) |
| 14 | **Skin port** | M | **Shipped v1** (`src/core/skin`, admin `/admin/skins`); SF-33 dark skin still queued |
| 14b | **Skin install packages** | M | **Shipped** — YAML+files packs (`skin.yaml` + `outlines/*.yaml` + `skin.css`); admin Skins upload/download; installed under `data/skins/`; Outlines admin lists create/inherit/copy per skin |
| 14c | **Outline Default-as-shell** | M | **Shipped** — inheritFrom/omitSectionIds merge on public load; nav outline → Page Settings; preferred shell soft-heal; model [skin-outline-model.md](./skin-outline-model.md) |

Also intentional thin: Events/Marketplace **dashboard stubs only** (SF-221) — no schema/UI until those Modules.

---

## Deferred Modules / Hero

Do **not** treat as Core leftovers (focus guard + prefs):

| Item | Queue / notes |
| --- | --- |
| Chat / Social / Stream / Shop / Marketplace schema | Parked. See [architecture-current](./architecture-current.md). Events, Maps, and Payments already exist. Subscriptions and Ads are the revenue-floor packs, not this deferred bucket. |
| **SF-8** ASN Hero | Theme + domain rules on Core+Modules |
| **SF-33** Public dark pastel Skin | Second registry entry + Skins admin select; not admin chrome |
| **SF-6** DO two-droplet hosting | After local-first + deploy checklist |
| **SF-222** WordPress migration | After Core + Modules + Hero |
| LLM / MediaAnalysis vendor ports | Paper until a consumer Module. MapProvider already shipped with `product:maps`. |
| Queues (BullMQ), webhooks, in-app notifications | On demand. i18n P0–P3 already shipped. |
| Video / ffmpeg; rich Media ACL / HEIC | Media pipeline “later” |
| Module Packages P2 (`@starforge/module-*`) | Nice-to-have |
| Tailwind + shadcn polish | Explicitly deferred |

---

## Top 5 next Core items

**Shipped after this list was written.** Do not pick these up again: D2 media aggregates (SF-226), D4 soft refresh (SF-227), Forms/Security/Performance cards (SF-228), email send log (SF-229), module info/settings (SF-230). Still open, and now the active Core pass: items 5, 6, 8, 10, 11, and 12 below, then the Forms/Redirects extract (item 9) as its own pass. Detail: [architecture-current](./architecture-current.md).

The public Skin port already shipped. Core glance and needs-attention are part of the finish, not optional leftovers.

---

## Verify

- [x] Read `docs/core-gaps-evaluation.md`, `docs/admin-dashboard-gap.md`, `preferences.md`, notes Done/Queued  
- [x] Spot-check: Media/Email loaders still `unavailable`; SF-221 stub set confirmed in `internal/stats-module-stub.md`  
- [x] This file at `docs/core-remaining.md`
