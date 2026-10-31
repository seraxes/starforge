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

## Admin UX (this PR)

- Left: particle palette (select → add).
- Canvas: sections with rows; click-to-add (drag-drop next).
- Per slot: width 1–12, enable/disable, remove.
- Custom: CodeMirror editors for HTML / CSS / JS (resizable).

## Next polish (not in this PR)

Gantry admin surfaces still to grow toward — keep the same visual/functional model:

| Gantry concept | Starforge next step |
| --- | --- |
| **Drag-drop** particles onto sections / reorder | HTML5 DnD or dnd-kit on the canvas |
| **Block settings** (CSS classes, variations, tag attributes, fixed size) | Per-slot settings panel (see [Block settings](https://docs.gantry.org/gantry5/tutorials/using-block-settings)) |
| **Section settings** (boxed/fullwidth, classes) | Fields on `LayoutSection` |
| **Styles** (theme SCSS / CSS) | Dedicated Styles admin with CodeMirror or **Monaco** + resizable panels — never plain textareas |
| **Outlines** (Base + per-context layouts) | Multiple named layout docs / inheritance |
| **Menu editor** (particles in menus) | After nav/menu depth grows |
| **Particle defaults** + inheritance | Defaults store + per-instance overrides |
| **Custom JS execution** | Developer-admin ACL only |
| **YAML export / edit mode** | Dev-admin optional surface; JSON remains storage |

## Add an extension particle

1. Create `src/modules/<id>/` with a `StarforgeModule`.
2. Register from `src/modules/catalog.ts`.
3. Place it on the canvas under `/app/admin/layouts`.
