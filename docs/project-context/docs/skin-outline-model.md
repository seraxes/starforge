# Skin + outline model (Base shell)

**Status:** Skin owns outlines. Each skin has one **Base** shell; every new outline is a **child** of that Base by default and carries `skin_id`.

## Concepts

| Piece | Role |
| --- | --- |
| **Skin** | Brand tokens + outline pack (`sf_layouts.skin_id`) |
| **Skin Base** | Inheritance root (`preferredDefaultOutlineId`, e.g. `starforge-pastel-default`). Label: **Pastel — Base**. |
| **Child outlines** | Created/duplicated under the active skin → `skin_id` set, `inheritFrom` = Base, empty local sections (live shell). |
| **Core `default`** | Bootstrap fallback only — not a skin Base. Badge: **Core**. |
| **Page assignment** | Page Settings `pageKey` → `layoutId` |
| **Offline** | Site Chrome `offlineLayoutId`; Pastel Offline inherits Base |

## Ownership

- Persisted: `sf_layouts.skin_id` (nullable). Apply with `npm run db:core:push`.
- Seeds set `skin_id` on install; create/duplicate under the active skin always write `skin_id`.
- Soft-heal backfills orphans by id prefix or `inheritFrom` → Base.
- Outlines **Skin** badge = `skin_id === activeSkin.id` (not id-prefix alone).

## Inheritance (Layouts + Styles)

| Surface | Unit | Behavior |
| --- | --- | --- |
| **Layouts → section cog** | Section | Inherit / Copy vs Base (parent) |
| **Layouts → particle** | Slot | Inheritance tab when parent has matching id |
| **Styles** | Section card | Inherit whole styles bag |
| **Page Settings** | Field | Inherit site global ← page (different axis) |

Admin edits **raw** docs; public + admin preview merge via `resolveLayoutInheritance` / `getLayoutDocumentForAdmin`.

## Create / duplicate

1. Belong to **active skin** (`skin_id`).
2. **From outline** — any outline (default: Base).
3. **Inherit** — thin child stub with live `inheritFrom` link to that source.
4. **Copy** — full snapshot of the source’s **resolved** layout (no inherit link).
5. Id prefers `{skinId}-{slug}` when auto-generated.

## Related

- `src/core/modules/layout-store.ts` — `skinId` on save/list/create/duplicate
- `src/core/skin/outline-seeds.ts` — seed + soft-heal
- Inventory: [core-modules-inventory.md](./core-modules-inventory.md)
