# Starforge modules + visual layout manager

Joomla-like **extension modules** hang off Starforge core — not Payload plugins.
Layout placement is a **document** (sections → named positions → module ids),
edited visually in core admin and stored as JSON.

## Quick map

| Piece | Path |
| --- | --- |
| Register API | `registerModule()` in `registry.ts` |
| Layout document (v2) | sections → positions → `modules[]` |
| Storage | `sf_layouts` (`document` JSON) · fallback `default-layout.json` |
| Admin UI | `/app/admin/layouts` |
| Public render | `PublicLayoutBody` + `<ModuleSlot position="…" />` |
| Example module | `src/modules/notice-bar/` |
| Catalog boot | `src/modules/catalog.ts` → `ensureModulesRegistered()` |

## Document shape

```json
{
  "version": 2,
  "sections": [
    {
      "id": "header-section",
      "label": "Header",
      "order": 0,
      "positions": [
        {
          "id": "header",
          "label": "Header",
          "order": 0,
          "modules": [{ "moduleId": "notice-bar", "enabled": true, "order": 0 }]
        }
      ]
    },
    {
      "id": "main-section",
      "label": "Main",
      "content": true,
      "positions": [
        {
          "id": "after-content",
          "label": "After content",
          "placement": "after",
          "modules": []
        }
      ]
    }
  ]
}
```

Legacy v1 flat `assignments[]` is still accepted on read and upgraded in memory.

## Rules

1. **Any module → any position** — no hard locks on where a module may render.
2. **Master toggle** — site-settings **Modules** (`features.modules`) must be on, or slots render nothing.
3. **Layout is data** — JSON in Postgres (`sf_layouts`); checked-in default JSON is the empty/fallback seed.
4. **Content section** — exactly one section should set `content: true` (SiteHeader + page children). Positions inside it use `placement: "before" | "after"`.

## Add a module

1. Create `src/modules/<id>/` with a `StarforgeModule` (`id`, `name`, `render`).
2. Call `registerModule(...)` from `src/modules/catalog.ts`.
3. Assign it under **`/app/admin/layouts`** (or seed `default-layout.json` / `ensureDefaultLayoutSeeded`).
4. Turn **Modules** on under `/app/admin/settings` (seed enables it for local demo).

## Path to a fuller visual editor

This slice is the **foundation**, not a Gantry clone:

- Visual UI to add/rename sections & positions and assign modules — done.
- JSON (and later YAML export) remains storage for diff/seed/export — not day-to-day editing.
- **Later:** drag-drop ordering, richer chrome, developer-admin “edit as YAML/JSON”, custom JS particles (dev-admin only), Joomla-like ACL for who may edit layout vs content vs JS.
