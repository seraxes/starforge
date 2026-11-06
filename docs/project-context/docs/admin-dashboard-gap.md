# Admin Dashboard — plan vs shipped gap

**Compared:** [admin-dashboard-plan](./admin-dashboard-plan.md) + [admin-dashboard-benchmarks](./admin-dashboard-benchmarks.md) vs `main` @ `e2b4442` (post [#127](https://github.com/seraxes/starforge/pull/127) D0, [#129](https://github.com/seraxes/starforge/pull/129) placeholders, [#130](https://github.com/seraxes/starforge/pull/130) landing lock, [#132](https://github.com/seraxes/starforge/pull/132) settings heal).  
**Verdict:** Host + Core user metrics are real; Media/Email cards are soft placeholders; soft refresh and all post-D1 module/Core glance widgets are still open — so `/admin` reads thin vs the plan’s “at a glance” promise.

---

## Shipped

### Host / IA (plan §1–3, D0)

| Piece | Where |
| --- | --- |
| Canonical home `/admin` (not Users, not Payload) | `src/app/(frontend)/admin/page.tsx` |
| Payload stays `/cms/admin` | remount [#128](https://github.com/seraxes/starforge/pull/128) |
| Logo → Dashboard | `ADMIN_DASHBOARD_HREF = '/admin'` |
| Manifest `admin.dashboard[]` → codegen registry | `src/generated/module-registry.ts` (+ `.server.ts`) |
| Host resolve (order, ACL, soft module-off shell) | `src/core/dashboard/resolve.ts`, `host.tsx` |
| Soft-fail per widget | `DashboardWidgetCard` / `DashboardSoftPlaceholder` |
| ACL resource `admin.dashboard` (+ Managers heal) | `src/core/acl/*`, `ensureManagersDashboardAcl` |
| Page chrome: title, lede, “Last refreshed …”, interval label | `/admin` page head (interval **display only**) |
| Settings knobs | `/admin/settings/performance` → `dashboardRefreshIntervalSec` (default **60**), `dashboardOnlineWindowMin` (default **15**) |
| Empty copy when no cards | `/admin` empty state |

### Core widgets — real data (plan §4–5, D0+D1 merged)

| Widget id | Module | Route / link-out | What works |
| --- | --- | --- | --- |
| `users.strip` | `platform:dashboard` | footer → `/admin/users` | Total users · Online now (session `updatedAt` window **B**) · New (10 days) · optional Site Online/Offline chip from Chrome |
| `users.latest` | `platform:dashboard` | footer → `/admin/users` | 10 latest: name, email, role, groups, registered-at |

Loaders: `src/core/dashboard/widgets/users-stats.ts` (`countOnlineUsers`, `loadUsersStripStats`, `loadLatestUsersStats`).

### Module contribution shells (plan D2/D3 scaffolding only)

| Widget id | Module | Order / size | Link-out | Status |
| --- | --- | --- | --- | --- |
| `media.counts` | `product:media` | 50 / `md` | `/admin/media` | Card shell + “Coming soon” / `—` rows |
| `email.sent` | `product:email-manager` | 60 / `md` | `/admin/email` | Same soft stub |

Events / Marketplace widgets correctly **omitted** (plan §8 prefer omit until real).

### Related shipped (adjacent, not full plan success)

- Settings → Modules catalog on/off at `/admin/settings` (toggles exist; **not** per-module info+settings pages + row deep-links from plan decision #6).
- Media already has its own settings surface: `/admin/media/settings`.
- Email Manager admin: `/admin/email`, `/admin/email/templates` (rules/templates; **no** durable send log table).
- Health probe exists but is DB-only: `GET /api/health`.

---

## Planned but missing

Phased plan (§10) vs `main`:

| Phase | Planned | Gap on main |
| --- | --- | --- |
| **D0** | Host + registry + ACL + refresh **hook** | **Done** (hook = settings fields + displayed interval; no client poll) |
| **D1** | Users strip + latest 10 | **Done** (shipped inside D0 PR, not a separate PR) |
| **D2** | Media kinds + totals + new 24h / 1w / 1m; module off → hide | **Missing aggregates.** `loadMediaCountsStats` always `{ ok: false, status: 'unavailable' }`. Toggle-off shows soft “Module disabled” shell (intentional vs plan’s “hidden” — host prefers no empty mosaic holes) |
| **D3** | Email count + type (+ optional title); link to Email Manager | **Blocked + stub.** No `sf_email_sends` / Mailer audit; `loadEmailSentStats` always unavailable. Card UI shape exists |
| **D4** | Soft refresh wired to settings interval | **Missing.** Page shows interval text; Performance form documents “follow-up (D4)”; no `router.refresh` / poll client on `/admin` |
| **D5** | Events / registrations / Marketplace widgets | **N/A** — packs not shipped (correct omit) |
| **Related** | Every module info+settings page + Modules-list links | **Mostly missing.** Catalog toggles only; Media/Email reuse existing admin menus, but Modules rows do not deep-link to each pack’s settings/info |

### Plan metrics still empty (owners exist)

- **Media** (`media.counts`): images/audio/video/docs/other totals + new windows — Payload Media + Media Manager taxonomy ready; loader not wired.
- **Email** (`email.sent`): by-type volume — needs durable log written on `Mailer.send` / Email Manager engine success (plan §6 open question #2 still open).

### Benchmarks “must-have soon” (after D0–D4) — none shipped as widgets

| # | Item | Proposed widget / owner | Notes |
| --- | --- | --- | --- |
| 1 | Needs attention strip | Core host (+ module rows) | Not started |
| 2 | System health | Core (`system.health` or similar) | `/api/health` is DB-only today |
| 3 | Form submissions | `product:forms` → e.g. `forms.submissions` | `sf_form_submissions` + `/admin/forms/submissions` exist; **no** `admin.dashboard[]` entry |
| 4 | Site Chrome status chip | Core (beyond offline already on `users.strip`) | Indexing/robots / captcha posture not on Dashboard |
| 5 | Admin activity | Core audit feed | No audit table → correctly skip |
| 6 | Modules enabled summary | Core Module Manager | Count enabled/allowlisted/disabled not on `/admin` |

Nice-later / skip lists in benchmarks remain out of scope for this gap.

---

## Placeholders only

Concrete soft cards that **look** like plan widgets but return no numbers:

1. **`product:media` / `media.counts`**  
   - UI: kind rows + New (24h) / (1 week) / (1 month) all `—`, status **Coming soon**.  
   - Loader: `src/modules/media/dashboard/media-stats.ts` → hard `unavailable`.  
   - Footer: `/admin/media`.

2. **`product:email-manager` / `email.sent`**  
   - UI: Sent (all) / Transactional / Marketing / System as `—`, **Coming soon**.  
   - Loader: `src/modules/email-manager/dashboard/email-stats.ts` → hard `unavailable`.  
   - Footer: `/admin/email`.  
   - Schema today: `sf_email_templates`, `sf_email_rules` only — no sends table.

3. **Refresh interval** on `/admin`  
   - Shows `refresh interval Ns (Settings → Performance)` but does not auto-refresh (D4).

4. **Module-disabled shells**  
   - Catalog-off Media/Email still occupy grid with “Module disabled” (host choice); plan text said hide — document as intentional deviation, not unfinished D2 hide logic.

---

## Recommended next PRs (ordered, sized)

| # | Slice | Size | Ship | Done when |
| --- | --- | --- | --- | --- |
| **1** | **D2 — Media aggregates** ★ next | **S–M** | Wire `loadMediaCountsStats` to Payload Media (mime/purpose → images/audio/video/docs/other) + created-at windows 24h/1w/1m; keep soft-fail; regenerate verify script to assert real path when DB seeded | `media.counts` shows numbers; toggle off → disabled shell (or hide if product flips decision); Core host untouched |
| **2** | **D4 — Soft refresh** | **S** | Client poll / RSC `router.refresh` on `/admin` using `dashboardRefreshIntervalSec`; pause when tab hidden | Changing Performance interval takes effect without redeploy; “Last refreshed” updates |
| **3** | **Core glance pack** (benchmarks #2+#4+#6) | **M** | Host-manifest widgets, `order < 50`: e.g. `system.health` (DB + Redis when selected + MediaStorage ready — extend `/api/health` or server loader), `chrome.status` (offline already on strip — add robots/indexing + captcha chip), `modules.summary` (enabled / allowlisted / disabled + link `/admin/settings`) | First viewport answers healthy / chrome posture / module counts |
| **4** | **D3 prep — send log** | **M** | Thin `sf_email_sends` (or Mailer audit) written on successful/soft-fail send from Email Manager engine / Mailer port | Rows durable; not scraped from console adapter |
| **5** | **D3 — Email card** | **S** (after #4) | Implement `loadEmailSentStats` count + type (+ optional template title); keep link `/admin/email` | `email.sent` leaves Coming soon |
| **6** | **Forms submissions card** | **S–M** | `product:forms` `admin.dashboard[]` id e.g. `forms.submissions`: total · 24h/7d · latest few; link `/admin/forms/submissions` | Appears only when Forms enabled |
| **7** | **Needs attention rail** | **M** | Core seeds (offline, Mailer off, health fail, env warnings for developer-admin) + optional module `sm` rows | Single severity · label · deep-link strip |
| **8** | **Modules UX (plan decision #6)** | **M** series | Per-module info/settings pages or reuse existing menus; Modules list row → open module | Every installed pack reachable from `/admin/settings` |

### ★ Recommend as the immediate next PR

**D2 Media aggregates (`media.counts`)** — highest user-visible densification for the least new surface area: taxonomy and card chrome already shipped; only the stats loader + queries are fake. Soft refresh (D4) is a good **same-week follow-up** or a tiny stacked PR if Media D2 stays focused.

Do **not** start Events/Marketplace stubs, admin activity UI, or widget rearrange before D2–D4 and at least one Core health/chrome glance card.

---

## Quick map (widget ids ↔ routes)

| Widget id | Module id | Admin routes |
| --- | --- | --- |
| *(page)* | — | `/admin` (Dashboard), `/cms/admin` (Payload) |
| `users.strip` | `platform:dashboard` | → `/admin/users`; knobs `/admin/settings/performance` |
| `users.latest` | `platform:dashboard` | → `/admin/users` |
| `media.counts` | `product:media` | → `/admin/media` (+ `/admin/media/settings`) |
| `email.sent` | `product:email-manager` | → `/admin/email` (+ `/admin/email/templates`) |
| *(future)* `forms.submissions` | `product:forms` | → `/admin/forms/submissions` |
| *(future)* health / chrome / modules | `platform:dashboard` | → `/admin/site-chrome`, `/admin/site-chrome/environment`, `/admin/settings` |

---

## Sources checked

- Store: `docs/admin-dashboard-plan.md`, `docs/admin-dashboard-benchmarks.md`
- Repo: `src/app/(frontend)/admin/page.tsx`, `src/core/dashboard/**`, `src/core/modules/host-manifests.ts`, `src/modules/{media,email-manager}/dashboard/**`, manifests, Performance settings form, `/api/health`
- Internal merge notes: `internal/admin-dashboard-d0.md`, `internal/dashboard-placeholder-widgets.md`
