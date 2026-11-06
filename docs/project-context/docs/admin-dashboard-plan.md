# Core admin Dashboard — plan

**Layer:** Core host + module contributions (same pattern as `admin.nav`).  
**Chrome:** Starforge admin — Gantry dark navy / blue-dominated; full-width; Page Settings panel language (not Layout canvas). **No** Hero / ASN theme.  
**Principle:** Dashboard is a **host**. Modules (and thin Core ports) **contribute widgets**; Core does not hard-code every future pack. Cards/sections render only when the contributing module is **installed + enabled** (and ACL allows).

Related: [platform-module-layers](./platform-module-layers.md), [design-module-boundary](./design-module-boundary.md), [asn-modules-wireframe](./asn-modules-wireframe.md), [email-manager-plan](./email-manager-plan.md), [email-mailer-plan](./email-mailer-plan.md), [site-settings-topics-plan](./site-settings-topics-plan.md), [module-toggle-architecture](./module-toggle-architecture.md).

**Decisions locked (Zoltán, 2026-11-05)** — see §9.

---

## 1. Goal

Admin home at **`/admin`** = **Starforge Dashboard**: site performance overview — who/what is on the site, media footprint, activity counts, email volume — at a glance. Empty when a pack is off; stubs stay dark until the module ships.

**Not** Payload’s CMS home: **`/cms/admin`** stays Payload-only. Keep the two admin surfaces separate (no merge, no shared “home”).

No second Starforge landing (`/admin/dashboard` optional alias only if routing needs it; canonical = `/admin`). Legacy `/app/admin` redirects to `/admin`.

---

## 2. Information architecture

| Region | Content | Always? |
| --- | --- | --- |
| **Page chrome** | Title “Dashboard”, short subtitle, last-refreshed; soft auto-refresh per **Dashboard refresh interval** setting | Yes |
| **Core — users strip** | Total users · Online now · Newly registered (last 10 days) · optional site online/offline from Chrome | Yes (Auth / Users) |
| **Core — latest users** | **10 latest** registered users with useful identity fields (name/email, registered date, role/groups as available) + link to Users | Yes |
| **Module grid** | Contributed widgets in `order` — responsive 2-col desktop, 1-col mobile | Only enabled contributors |
| **Empty state** | If only Core strip: one line that more cards appear when Modules are enabled | Yes |

**Nav:** Core top-level **Dashboard** (first item, before Site Chrome) → `/admin`. Not under CMS. Payload’s own dashboard stays at `/cms/admin` only.

**ACL:** `admin.dashboard` area (view). Widget data may require the module’s area too (e.g. Media card needs Media ACL or falls back to count-only).

**Not in v1:** user-rearrange / hide widgets, full charts drill-down, Hero KPIs, marketing “stats strip” chrome, a second Starforge “home” besides Dashboard.

### Settings → Modules (convention)

Joomla-like **Modules** catalog only (not a Components tree):

- **Site Settings → Modules** remains the on/off catalog ([site-settings-topics-plan](./site-settings-topics-plan.md)).
- **Every module** gets an **info + settings** page (description, status, module-owned knobs via `sf_module_settings` / manifest panel — [design-module-boundary](./design-module-boundary.md)).
- If the module **already has** a Settings (or equivalent) admin menu entry, **reuse that** as its settings/info surface — do not duplicate.
- If it has **no** menu yet, still create the info+settings page and **link it from the Modules list** (row → open module).
- Dashboard **refresh interval** is a **setting** (Dashboard / Performance topic or Core builtin module settings — product picks one home; not a hard-coded constant).

---

## 3. Widget registry contract

Mirror **admin nav** contributions: declare in the module manifest; codegen → `src/generated/module-registry.ts`; Core host merges + filters by toggle + ACL.

```ts
// Extend StarforgeModuleManifest.admin (design-module-boundary)
admin?: {
  nav?: …
  routes?: …
  dashboard?: Array<{
    id: string                    // stable: 'media.counts' | 'email.sent' | …
    title: string
    order?: number                // default 100; Core strip uses reserved < 50
    size?: 'sm' | 'md' | 'lg'     // grid span hint
    area?: string                 // ACL; omit = admin.dashboard only
    /** Codegen-visible Server Component that returns the card body */
    widgetImportPath: string
    widgetExportName?: string
    /**
     * Optional JSON loader for SSR numbers (preferred over fetching inside UI).
     * Host calls when module enabled; soft-fail → card shows “—” / retry.
     */
    statsImportPath?: string
    statsExportName?: string
  }>
}
```

**Host rules**

1. Load contributions from generated registry only — **no** `if (flags.events)` in Core UI.
2. Skip if module missing from allowlist, toggle off, or ACL denies `area`.
3. Soft-fail per widget (one broken pack must not blank the page).
4. Core-owned widgets (users / online / latest-10 / new-in-10d) live in a **host manifest** entry (`platform:dashboard` or Core builtin), not scattered product `if`s.
5. Future packs (Events, Marketplace, …) add `admin.dashboard[]` in their PR; Core host unchanged.
6. Soft refresh: host re-fetches widget stats on the configured interval (client poll or RSC refresh); interval from settings, default TBD (~60s).

---

## 4. Stats → module / port map

| Widget / metric | Owner | Data home / port | Notes |
| --- | --- | --- | --- |
| **Total users** | Core Auth / Users | Better Auth / `user` table | Always on |
| **Online now** | Core Auth (+ optional Redis) | See §5 | Always on |
| **Newly registered (10d)** | Core Auth / Users | `user.createdAt` window | Always on |
| **Latest 10 users** | Core Auth / Users | Recent `user` rows + display fields | Always on; not a full Users drill-down |
| **Media — all kinds + stats** | `product:media` | Payload Media mime / purpose / kind | Totals per kind **and** new counts **24h / 1 week / 1 month** |
| **Emails — count + type (+ title)** | `product:email-manager` | Send log (§6); transport = Core **Mailer** | Summary only — not full log drill-down on the card |
| **Events count** | `product:events` | `sf_events_*` / Payload events | **Stub** until Events ships |
| **Game / event registrations** | `product:events` + Forms | Registrations / Form submissions with event preset | **Stub**; confirm seats vs all submissions later |
| **Marketplace products** | `product:marketplace` | Listings table | **Stub** until Marketplace ships |
| Site offline / Chrome health (optional chip) | Core Site Chrome | Chrome document | Tiny; not a module card |

**Ports (thin):** Mailer (already), optional **Presence** / session secondary store (Redis) for online; no per-widget vendor SDKs.

---

## 5. Online users — approach

| Option | Pros | Cons |
| --- | --- | --- |
| **A. Session heartbeat** — authenticated clients ping `/api/presence` every N min; Redis SET with TTL | Accurate “active now”; fits DO Redis later | Needs client hook + Redis (or in-memory local) |
| **B. Session table window** — count sessions with `updatedAt` within last X min | No new client code if Better Auth already touches sessions | Weaker if sessions aren’t refreshed on browse |
| **C. “Logged in today”** | Cheap | Not “online” |

**Recommend:** **B for v1** (session activity window, default ~15 min; window minutes live next to Dashboard refresh in settings). Design the widget API so **A** can replace the loader without changing the card UI. Count **all authenticated** sessions unless ACL/product later narrows by role/group. Anonymous public traffic is out of scope (analytics, not admin presence).

**User metrics bundle (Core):** total · online · newly registered last **10 days** · **10 latest** users (identity + registered-at). Enough for a complete “who’s on the site” glance without opening Users.

---

## 6. Email metrics

- **Transport** stays Core Mailer ([email-mailer-plan](./email-mailer-plan.md)); Dashboard never talks SMTP.
- **Source of truth:** Email Manager **send log** (or Mailer audit table written on each `Mailer.send` success/soft-fail) — not provider dashboards.
- **Card (locked):** **count + type** (+ optional **title** / template name) — at-a-glance volume by kind. **Not** a full filtered log / drill-down UI on the Dashboard (link out to Email Manager for that).
- **Windows:** still useful as aggregates (e.g. day/week/month) behind the summary if cheap; primary UX is type breakdown, not a deep report.
- Soft-fail / Chrome email off → show zeros or “Email disabled”.
- If #121 shipped rules/templates **without** a durable log, Phase D3 is blocked until a thin `sf_email_sends` (or equivalent) lands — do not scrape console adapter output.

---

## 7. Media metrics

- List **all media kinds** present (images / audio / video / docs / other as Media defines) with **totals**.
- Also show **new** uploads (or created media) for **last 24h / 1 week / 1 month**.
- Kind taxonomy: prefer Media Manager’s existing kind / mime / purpose classification — Dashboard mirrors library categories, does not invent a second taxonomy.
- Module off → widget hidden.

---

## 8. Stubs for unbuilt modules

Until Events / Marketplace exist:

- Manifest may declare dashboard widgets with `stats` returning `{ status: 'unavailable' }`, **or** omit widgets until the pack’s first schema PR.
- Prefer **omit until real** — avoids empty gray cards. Host empty-state copy covers “more when modules land.”
- When Events/Marketplace ship: add `admin.dashboard` + stats loader in the **same** module PR (acceptance: Core host untouched).

---

## 9. Decisions (Zoltán, 2026-11-05)

| # | Decision |
| --- | --- |
| 1 | **`/admin`** = Starforge Dashboard; **`/cms/admin`** = Payload CMS only — keep separate. |
| 2 | Show **10 latest users** with useful info on the Dashboard. |
| 3 | Email widget: **count + type** (+ maybe **title**) — not full drill-down. |
| 4 | Media: **all kinds + stats**; also **new** counts for **24h / 1 week / 1 month**. |
| 5 | **Complete user metrics:** newly registered last **10 days**, online, totals, latest-10, etc. |
| 6 | **Refresh interval** = a **setting**. Every module gets its own **info + settings** page (Joomla-like, **Modules only**). Reuse existing Settings menu when present; otherwise still create the page. Link from **Settings → Modules**. |
| 7 | **Admin Dashboard is enough** — no extra Starforge home. |

### Still open (implementation detail — not blocking IA)

1. **Online window minutes** default (recommend ~15) and whether settings live under Performance vs Dashboard module panel.
2. **Email durable log** ownership if #121 lacks it — Mailer-port audit (Core) vs Email Manager table.
3. **Registrations metric** (Events phase): all Form `event-registration` submissions vs Events-confirmed seats only.
4. **ACL:** keep global `admin.dashboard` + optional per-widget `area` as designed; confirm if module cards always require their own area.

---

## 10. Phased build

| Phase | Ship | Done when |
| --- | --- | --- |
| **D0** | Manifest `admin.dashboard[]` + codegen + host page at **`/admin`** (grid, ACL, soft-fail, refresh setting hook) | Dashboard is the admin landing; nav link live |
| **D1** | Core user metrics: total · online (B) · new in 10d · **latest 10** | Numbers match Users admin |
| **D2** | Media: all kinds + totals + new 24h / 1w / 1m | Splits correct; module off → hidden |
| **D3** | Email: count + type (+ optional title); link to Email Manager | Needs send log; no full drill-down on card |
| **D4** | Soft refresh wired to settings interval | Interval change takes effect without redeploy |
| **D5** | Events / registrations / Marketplace widgets | With those modules — stubs optional, prefer real |
| **Related (Modules UX)** | Per-module info+settings pages + Modules-list links (reuse existing Settings menus) | Every installed module reachable from Settings → Modules |

No Hero work in this track. One PR per phase where practical; merge before the next. Modules info/settings convention may ship as its own PR series alongside or just after D0–D1 (host needs somewhere for refresh + future knobs).

---

## Success

- Enabling/disabling Media or Email Manager shows/hides those cards with **no Core hardcoded list** of product widgets.
- Events/Marketplace PRs add cards via manifest only.
- Admin looks like other Core pages (Gantry chrome), not ASN Hero.
- `/admin` is the only Starforge admin home; `/cms/admin` remains Payload.
- Email volume is explainable from Manager/Mailer logs (summary card), not guessed from SMTP.
- Settings → Modules opens each module’s info/settings surface (or its existing Settings menu).
