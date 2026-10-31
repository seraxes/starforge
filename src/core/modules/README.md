# Starforge modules + Gantry-like layout manager

Follows the [Gantry 5 Layout Manager](https://docs.gantry.org/gantry5/configure/layout-manager) model:
left **Particles** palette, main canvas of **Sections**, slots with block widths on a
**12-column** grid. Starforge owns the grid math (flex) — **do not** pull Bootstrap.

Reference: [docs.gantry.org](https://docs.gantry.org/).

## Quick map

| Piece | Path |
| --- | --- |
| Register API | `registerModule()` in `registry.ts` |
| Built-in particles | `page-content`, `site-header`, `custom` · `particles/` |
| Example extension | `src/modules/notice-bar/` |
| Layout document (v3) | sections → rows → slots (`moduleId` + `width` 1–12) |
| Storage | `sf_layouts` JSON · fallback `default-layout.json` |
| Admin UI | `/app/admin/layouts` — palette + canvas |
| Code editors | CodeMirror 6 (`CodeEditorField`) for Custom HTML/CSS/JS |
| Public render | `PublicLayoutBody` + `SlotRenderer` |

## Document shape

```json
{
  "version": 3,
  "sections": [
    {
      "id": "header",
      "label": "Header",
      "rows": [
        {
          "id": "header-row-1",
          "slots": [
            { "id": "…", "moduleId": "notice-bar", "width": 12, "enabled": true }
          ]
        }
      ]
    },
    {
      "id": "main",
      "label": "Main",
      "rows": [
        {
          "id": "main-row-1",
          "slots": [
            { "id": "…", "moduleId": "page-content", "width": 12 }
          ]
        }
      ]
    }
  ]
}
```

Legacy v1 / v2 upgrade on read.

## Rules

1. **Any particle → any section/slot** — no hard locks.
2. **Built-ins** (`page-content`, `site-header`, `custom`) always render.
3. **Extension particles** need site-settings **Modules** on (+ optional per-module flag).
4. **Width** is 1–12 columns; Starforge flex math only (no Bootstrap CSS).
5. **Custom** stores HTML + CSS + JS; JS is **not executed** until developer-admin ACL.
6. **No plain textareas for code** — Custom / future Styles use CodeMirror (syntax highlight + resizable panels). Monaco is an optional later upgrade for a heavier Styles IDE.

## Admin UX (this PR) — Gantry Layout Manager flow

1. **Create section**
2. **Add row** inside the section
3. **Drag** a particle from the left palette **into the row**
4. Drop a second beside it → same row, widths rebalance (~50%/50%); **drag the divider** to resize by % (stored as 1–12)
5. Custom particle: CodeMirror HTML/CSS/JS (resizable panels — no plain code textareas)

## Next polish (not in this PR)

| Gantry concept | Starforge next step |
| --- | --- |
| Reorder particles / drag between rows | Extend HTML5 DnD |
| **Block settings** (CSS classes, variations, tag attributes) | Per-slot settings panel |
| **Section settings** (boxed/fullwidth, classes) | Fields on `LayoutSection` |
| **Styles** | Styles admin with CodeMirror or **Monaco** |
| **Outlines** | Multiple named layout docs / inheritance |
| **Menu editor** | After nav/menu depth grows |
| **Particle defaults** + inheritance | Defaults store + overrides |
| **Custom JS execution** | Developer-admin ACL only |
| **YAML export / edit mode** | Dev-admin optional; JSON remains storage |

## Add an extension particle

1. Create `src/modules/<id>/` with a `StarforgeModule`.
2. Register from `src/modules/catalog.ts`.
3. Place it on the canvas under `/app/admin/layouts`.
