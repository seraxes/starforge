# Payload + Core admin theme (replaceable)

Align Payload `/admin` with Core `/app/admin` (Gantry Helium dark navy, pastel blue chrome, orange primary actions) and keep one left-nav tree. Theme is a **replaceable port**, not a one-off CSS dump.

Related: [replaceable-modularity-plan](./replaceable-modularity-plan.md), preferences (seamless Core↔Payload chrome; UI kit later).

## Goals

1. **Visual** — Payload chrome uses the same Starforge tokens as Core dark admin.
2. **IA** — One left nav: Core top-level items + **CMS** accordion → Payload destinations (Dashboard, Pages, Media, Users). Site Settings is Core top-level only (not under CMS). Payload mirrors the same tree.
3. **Replaceable theme** — `src/core/admin-theme` registry + active CSS entrypoints so a second look can plug in without rewriting nav sync.

## Ports vs modules

| Piece | Kind | Notes |
| --- | --- | --- |
| `admin-theme` | Infrastructure port | Active theme id (`STARFORGE_ADMIN_THEME`); CSS via `active-core.css` / `active-payload.css` |
| `admin-nav` | Shared Core helper (not a Site Settings module) | `buildAdminNavGroups()` — single source of truth for both sidebars |
| Payload CMS | Feature / platform module | Already toggled; nav CMS children respect `visibleEntities` on Payload |

Theme does **not** own nav structure. Switching themes must not fork the tree.

## Layout

```
src/core/admin-theme/
  types.ts / registry.ts / index.ts
  active-core.css          ← @import current theme Core chrome
  active-payload.css       ← @import current theme Payload chrome
  themes/starforge-gantry/
    index.ts + tokens.ts
    core-chrome.css        ← former admin-dark.css
    payload-chrome.css     ← Payload variables + embedded sidebar

src/core/admin-nav/
  build.ts / cms.ts / types.ts   ← shared groups + CMS_NAV_LINKS

src/components/admin/AdminSidebarNav.tsx   ← shell | embedded
src/components/payload/StarforgeAdminNav.tsx  ← admin.components.Nav
```

## First theme: `starforge-gantry`

- Dark navy canvas, mid-blue hover/active (`#3498db`), light-blue borders, white text.
- **Orange only** on primary actions (Payload `.btn--style-primary`).
- Payload `admin.theme: 'dark'` locked to match.
- Success/focus scale remapped toward Helium blue (no purple AI-default look).

## Nav sync

- Core CMS group expands to Payload URLs (`/admin`, `/admin/collections/…`).
- Payload Nav **replaces** DefaultNav so collections are not a second IA — they appear under CMS.
- **Site Settings** stays Core top-level only (`/app/admin/settings`) — not duplicated under CMS (no Payload global link in `CMS_NAV_LINKS`).
- Module flags (Nav, Forms, Layouts, …) still gate Core leaves on both surfaces via Site Settings.

## Adding a second theme (later)

1. Add `themes/<id>/` with tokens + `core-chrome.css` + `payload-chrome.css`.
2. Register in `registry.ts`.
3. Point the **live** imports at the new sheets (JS `import` of the `.css` file — nested CSS `@import` via `active-*.css` / `custom.css` is unreliable in Next/Turbopack and leaves `/admin` stock-looking):
   - Core: `src/app/(frontend)/layout.tsx` → theme `core-chrome.css`
   - Payload: `src/app/(payload)/layout.tsx` → theme `payload-chrome.css` (`custom.css` stays as the empty Payload hook)
4. Set `STARFORGE_ADMIN_THEME=<id>` (runtime metadata / `data-sf-admin-theme`); keep nav on `admin-nav`.

Optional later: Site Settings picker (ops-facing) once more than one theme ships — still a port, not a product particle.

## Gaps (Payload limits)

- Cannot fully restyle Lexical / every internal widget without brittle selectors — tokens cover most chrome.
- Payload hamburger / collapse animation stays Payload’s; we theme the rail and embed Core accordion markup.
- Dashboard collection cards may still look “Payload default” in places; iterate with token passes.
- Full Tailwind/shadcn shared kit remains a later polish (preferences).

## Verify

- Core `/app/admin`: dark Helium chrome unchanged; CMS accordion lists Payload destinations.
- Payload `/admin`: same top-level labels/order; CMS children = collections/globals; primary Save orange.
- Public site stays light; Core admin still works with Payload module off (CMS group hidden).
