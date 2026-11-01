# Starforge modules + Gantry-like layout manager

Follows the [Gantry 5 Layout Manager](https://docs.gantry.org/gantry5/configure/layout-manager) model:
left **Particles** palette, main canvas of **Sections**, slots with block widths as
**percent** (1% steps; min 5%). Starforge owns the flex math — **do not** pull Bootstrap.

Reference: [docs.gantry.org](https://docs.gantry.org/).

## Quick map

| Piece | Path |
| --- | --- |
| Register API | `registerModule()` in `registry.ts` |
| Built-in particles | `page-content`, `site-header`, `logo` (image/text), `menu`, `copyright`, `social`, `custom` · `particles/` |
| Example extension | `src/modules/notice-bar/` |
| Core Form | `src/modules/form/` · submissions `sf_form_submissions` · Admin `/app/admin/forms` |
| Layout document (v3) | sections → rows → slots (`moduleId` + `width` %) |
| Storage | `sf_layouts` JSON · fallback `default-layout.json` |
| Admin UI | `/app/admin/layouts` — palette + canvas |
| Code editors | CodeMirror 6 (`CodeEditorField`) for Custom HTML/CSS/JS |
| Public render | `PublicLayoutBody` + `SlotRenderer` |

## Document shape

```json
{
  "version": 3,
  "styles": {
    "breakpoints": {
      "largeDesktop": "75rem",
      "desktop": "60rem",
      "tablet": "48rem",
      "mobile": "30rem",
      "mobileMenu": "48rem"
    }
  },
  "sections": [
    {
      "id": "header",
      "label": "Header",
      "containerMode": "full",
      "cssClass": "dark-header",
      "rows": [
        {
          "id": "header-row-1",
          "slots": [
            {
              "id": "…",
              "moduleId": "notice-bar",
              "name": "Promo notice",
              "width": 100,
              "enabled": true,
              "accessLevel": "public"
            }
          ]
        }
      ]
    },
    {
      "id": "main",
      "label": "Main",
      "containerMode": "boxed",
      "rows": [
        {
          "id": "main-row-1",
          "slots": [
            { "id": "…", "moduleId": "page-content", "width": 100 }
          ]
        }
      ]
    }
  ]
}
```

- `section.label` — editable canvas display name (id stays stable).
- `section.containerMode` — `full` | `boxed` (section owns width; row % inside). Omitted → Page Settings sections-layout default.
- `section.styles` — Gantry-like Section Styles: `backgroundColor` / `textColor` (hex); `backgroundImage` / `backgroundOverlay` reserved. Applied on the public section wrapper only.
- `section.cssClass` — space-separated classes on the public section/`footer` wrapper (plus `sf-layout-section`).
- `styles.breakpoints` — outline-scoped rem/px presets (`/app/admin/breakpoints`). Default outline = site global. No separate Styles mega-page.
- `slot.name` — optional instance display name on the canvas; does **not** change `moduleId`.
- `slot.accessLevel` — who can see (`public` / `registered` / `group:<id>`); same groups as Nav tags; `SlotRenderer` filters by session.

Legacy v1 / v2 upgrade on read.

## Rules

1. **Any particle → any section/slot** — no hard locks.
2. **Built-ins** (`page-content`, `site-header`, `logo`, `copyright`, `social`, `custom`) always render.
3. **Extension particles** need site-settings **Modules** on (+ optional per-module flag).
4. **Width** is an integer **percent** (1% steps; min **5%**, max **95%** when shared so the pair can sum to 100%). Starforge flex math only (no Bootstrap).
5. **Typed Core particles** (`logo`, `copyright`, `social`) store structured config JSON and render with their own components — **not** Custom HTML blobs.
6. **Custom** remains the free-form escape hatch (HTML + CSS + JS); JS is **not executed** until developer-admin ACL.
7. **No plain textareas for code** — Custom / future Styles use CodeMirror (syntax highlight + resizable panels). Monaco is an optional later upgrade for a heavier Styles IDE.

## Admin UX (this PR) — Gantry Layout Manager flow

1. **Create section** — edit **name**, **Width** (full / boxed), + **CSS classes** inline; drag the **⋮⋮** handle to **reorder sections** (persists `order` in JSON). Outline **Breakpoints** live at `/app/admin/breakpoints` (Layouts → Breakpoints).
2. **Add row** inside the section
3. **Drag** a particle from the left palette **into the row** — edit the instance **display name** (type id unchanged)
4. Drop a second beside it → **side-by-side** in one horizontal row (~50%/50%; `flex-wrap: nowrap`); **drag the divider** to resize in **1%** steps (**5%–95%**, pair sums to **100%**). Particle settings expand **inside** the cell — they never force the row to stack.
5. Layout admin page is **full width** (no narrow max-width column)
6. **Drag ⋮⋮** on a particle to **reorder** left↔right in the same row (keeps % widths) **or move** into another section’s row (both rows rebalance %)
7. Custom particle: CodeMirror HTML/CSS/JS (resizable panels — no plain code textareas)
8. Typed / Custom settings open in a **floating overlay** (does not expand the slot or push the row; Escape / outside click closes)

### Typed Core particles

| Id | Config | Public render |
| --- | --- | --- |
| `logo` | `mediaId` / `mediaUrl`, `alt`, optional `maxWidth`/`maxHeight`, optional `linkUrl` | `<img>` or placeholder; Media id resolves via Payload |
| `copyright` | `text`, `yearMode` (`auto`\|`manual`) + `year`, optional `linkUrl`/`linkLabel` | `© {year} {text}` + optional link |
| `social` | `items[]` of `{ id, platform, url, label?, icon? }` | Nav list of links |

Custom stays available for free-form HTML — do **not** generate Logo/Copyright/Social into Custom blobs.

## Next polish (not in this PR)

| Gantry concept | Starforge next step |
| --- | --- |
| Drag particles between rows | Extend HTML5 DnD |
| **Block settings** (CSS classes, variations, tag attributes) | Per-slot settings panel (section `cssClass` + slot `name` already ship) |
| **Section settings** (boxed/fullwidth beyond classes) | More fields on `LayoutSection` |
| **Styles** | Styles admin with CodeMirror or **Monaco** |
| **Outlines** | ✅ Multiple named layout docs (`/app/admin/outlines`) — create / rename / duplicate / select; Page Settings assigns any outline |
| **Menu editor** | After nav/menu depth grows |
| **Particle defaults** + inheritance | Defaults store + overrides |
| **Custom JS execution** | Developer-admin ACL only |
| **YAML export / edit mode** | Dev-admin optional; JSON remains storage |

## Add an extension particle

1. Create `src/modules/<id>/` with a `StarforgeModule`.
2. Register from `src/modules/catalog.ts`.
3. Place it on the canvas under `/app/admin/layouts`.
