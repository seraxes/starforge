# Skin + outline model (Base shell)

**Status:** Skin owns outlines. Each skin is a **YAML + files pack** on disk. Each skin has one **Base** shell; every new outline is a **child** of that Base by default and carries `skin_id`.

## Pack on disk

```text
<skin-id>/
  skin.yaml          # id, label, colorScheme, tokens, preferredDefaultOutlineId
  skin.css           # optional extras (body.sf-skin-<id>)
  outlines/
    <outline-id>.yaml
```

- Bundled: `src/core/skin/skins/<id>/`
- Installed: `data/skins/<id>/` (upload)
- Download zip re-exports live `sf_layouts` rows for that `skin_id` as YAML
- Runtime working copy of layouts stays JSONB in `sf_layouts`; site default skin id in `sf_module_settings` (`core:skin`)

## Concepts

| Piece | Role |
| --- | --- |
| **Skin** | Brand tokens + outline pack (`sf_layouts.skin_id`) |
| **Skin Base** | Inheritance root (`preferredDefaultOutlineId`, e.g. `starforge-pastel-default`). Label: **Pastel — Base**. |
| **Child outlines** | Created/duplicated under the active skin → `skin_id` set, `inheritFrom` = Base, empty local sections (live shell). |
| **Core `default`** | Bootstrap fallback only — not a skin Base. Badge: **Core**. |
| **Page assignment** | Nav menu item `layoutId` → layoutId-only pageKey row. Page Settings chrome is outline-gated (Base = `global`; children = `outline:<id>`). |
| **Offline** | Site Chrome `offlineLayoutId`; Pastel Offline inherits Base |
| **Public body CSS** | `body.sf-skin-{skinId}` + `body.sf-outline-{outlineId}` — unique classes; compound `body.sf-skin-*.sf-outline-*` always wins for outline vars |

## Public CSS hierarchy (Skin module)

1. Platform defaults — `styles.css` `:root`
2. Skin — `body.sf-skin-{id}` tokens (+ pack `skin.css`)
3. Outline — `body.sf-skin-{id}.sf-outline-{id}` breakpoints / `--sf-container-max`
4. Sections — `[data-sf-container=boxed]` consumes `--sf-container-max`; `full` ignores it

Helpers: `src/core/skin/css-scope.ts`. Injectors: `SkinRootStyles`, `LayoutOutlineStyles`. Body stamp: `BodyAttributesApplier`.

## Ownership

- Persisted: `sf_layouts.skin_id` (nullable). Apply with `npm run db:core:push`.
- Seeds set `skin_id` on install; create/duplicate under the active skin always write `skin_id`.
- Soft-heal backfills orphans by id prefix or `inheritFrom` → Base.
- Outlines **Skin** badge = `skin_id === activeSkin.id` (not id-prefix alone).

## Inheritance — two separate axes

**Toolbar:** Skin picker (which outline pack) + Outline picker (which outline in that pack).

### Axis A — Layout & Styles (outline-gated, not skin)

| Outline | Inherit / Copy |
| --- | --- |
| **Base** (`preferredDefaultOutlineId`) | **Hidden** |
| **Any other outline** | **Shown** (live link / snapshot vs parent, usually Base) |

Switching skins only changes which outlines are listed. The rule is always Base vs other outline.

### Axis B — Page Settings (outline-gated chrome)

Same Inherit/Copy gate as Layout & Styles (Axis A):

| Outline | Page Settings Inherit / Copy |
| --- | --- |
| **Base** | **Hidden** — edits `sf_page_chrome.global` (source) |
| **Any other outline** | **Shown** — sparse `outline:<id>` row; inherit/copy from Base |

Toolbar Skin + Outline pickers scope which chrome you edit. There is no page picker.

Nav menu items still assign which outline a page uses (`layoutId` → layoutId-only pageKey row). Runtime merges Base chrome + that outline’s sparse overrides. If the page chrome row is missing, public resolve falls back to the nav item’s `layoutId` (e.g. Events → Pastel-Test). Empty inheriting children must keep `inheritFrom` + `sections: []` on save — never seed the core default in place of the stub.

Admin edits **raw** layout docs; public + admin preview merge via `resolveLayoutInheritance` / `getLayoutDocumentForAdmin`.

## Admin IA

- **Skins** (`/admin/skins`) — list installed packs, set default, upload/download (no outline column).
- **Outlines** (`/admin/outlines`) — list/create/rename/duplicate/delete per active skin; Create with **Inherit** or **Copy**.
- **Layouts chrome** — outline switcher + manage link.

## Create / duplicate

1. Belong to **active skin** (`skin_id`).
2. **From outline** — any outline (default: Base).
3. **Inherit** — thin child stub with live `inheritFrom` link to that source.
4. **Copy** — full snapshot of the source’s **resolved** layout (no inherit link).
5. Id prefers `{skinId}-{slug}` when auto-generated.

## Related

- `src/core/skin/pack-io.ts` — YAML pack load/write
- `src/core/modules/layout-store.ts` — `skinId` on save/list/create/duplicate
- `src/core/skin/outline-seeds.ts` — seed + soft-heal
- Inventory: [core-modules-inventory.md](./core-modules-inventory.md)
