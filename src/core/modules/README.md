# Starforge modules + layout positions

Joomla-like **extension modules** hang off Starforge core — not Payload plugins.

## Quick map

| Piece | Path |
| --- | --- |
| Register API | `registerModule()` in `registry.ts` |
| Named positions | `header`, `after-content`, `footer` (`LAYOUT_POSITIONS`) |
| Layout document | `default-layout.json` (module → position assignments) |
| Public render | `<ModuleSlot position="…" />` in the public layout |
| Example module | `src/modules/notice-bar/` |
| Catalog boot | `src/modules/catalog.ts` → `ensureModulesRegistered()` |

## Rules (locked for this slice)

1. **Any module → any position** — no hard locks on where a module may render.
2. **Master toggle** — site-settings **Modules** (`features.modules`) must be on, or slots render nothing.
3. **Layout is data** — assignments live in JSON today; a future visual editor will edit the same shape (YAML/JSON under the hood).

## Add a module

1. Create `src/modules/<id>/` with a `StarforgeModule` (`id`, `name`, `render`).
2. Call `registerModule(...)` from `src/modules/catalog.ts`.
3. Add an assignment in `src/core/modules/default-layout.json` (pick any position).
4. Turn **Modules** on under `/app/admin/settings` (seed enables it for local demo).

## Path to visual layout (later)

- Storage stays a layout document (`version` + `assignments[]`).
- Visual editor = primary UX (add section, name positions, assign modules).
- Optional “edit as YAML/JSON” for developer-admins only.
- Custom JS particles and ACL come after the first editor slice.
