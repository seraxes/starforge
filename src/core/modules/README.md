# Starforge modules + Gantry-like layout manager

Joomla/Gantry-like **particles** (modules) hang off Starforge core — not Payload plugins.
Layout is a JSON document: **sections → rows → slots** (`moduleId` + `width` 1–12).

## Quick map

| Piece | Path |
| --- | --- |
| Register API | `registerModule()` in `registry.ts` |
| Built-in particles | `page-content`, `site-header`, `custom` · `particles/` |
| Example extension | `src/modules/notice-bar/` |
| Layout document (v3) | sections → rows → slots |
| Storage | `sf_layouts` JSON · fallback `default-layout.json` |
| Admin UI | `/app/admin/layouts` — left palette + canvas |
| Public render | `PublicLayoutBody` + `SlotRenderer` (12-col flex math, **not Bootstrap**) |

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

Legacy v1 (flat assignments) and v2 (positions) upgrade on read.

## Rules

1. **Any particle → any section/slot** — no hard locks.
2. **Built-ins** (`page-content`, `site-header`, `custom`) always render.
3. **Extension particles** need site-settings **Modules** on (+ optional per-module flag).
4. **Width** is 1–12 columns; Starforge owns the flex math (no Bootstrap CSS).
5. **Custom** stores HTML + CSS + JS; JS is **not executed** until developer-admin ACL.

## Admin UX (v1)

- Left: particle palette (click to select).
- Canvas: sections with rows; **Add** places the selected particle (click-to-add).
- Per slot: set width 1–12, enable/disable, remove; Custom opens HTML/CSS/JS editor.
- Later: true drag-drop, YAML export mode, JS ACL.

## Add an extension particle

1. Create `src/modules/<id>/` with a `StarforgeModule`.
2. Register from `src/modules/catalog.ts`.
3. Place it on the canvas under `/app/admin/layouts`.
