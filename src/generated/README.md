# Generated module registry

`module-registry.ts` is produced by `npm run modules:generate` from:

| Input | Role |
| --- | --- |
| [`starforge.modules.json`](../../starforge.modules.json) | Install/build allowlist (or env `SF_MODULES`) |
| [`src/modules/manifest-index.ts`](../modules/manifest-index.ts) | Aggregates `defineStarforgeModule` manifests (host + packs) |

## Allowlist vs Site Settings toggle

| Layer | What it does |
| --- | --- |
| **Allowlist** (`starforge.modules.json`) | Which modules are *installed* in this build. Missing packs are omitted from generated `import()` loaders → not eager-bundled. |
| **Runtime toggle** (Site Settings → Modules) | On/off for *installed* modules only — palette, nav, public render. Does not remove code from disk/bundle. |

Required: `platform:better-auth`, `page-content` (always forced into the allowlist).

## What codegen emits

- Allowlist id sets + `isModuleAllowlisted`
- `ALLOWLISTED_PRODUCT_PLATFORM_META` — **one** Settings catalog for platform/product (replaces hand-maintained `PRODUCT_MODULE_CATALOG`)
- `ALLOWLISTED_PARTICLE_META` / optional particle + atom loaders
- `publicShellLoaders` — Consent (and later packs) contribute public layout slots without Core importing `@/modules/**`
- `moduleMessageLoaders` (server registry) — allowlisted `messages/<locale>.json` packs for next-intl merge (i18n P3)

## Adding a pack

1. Add `src/modules/<id>/manifest.ts` with `defineStarforgeModule({...})`
2. Register it in `src/modules/manifest-index.ts`
3. Add the id to `starforge.modules.json`
4. Optional UI chrome: `messages/en.json` (+ locales) and `i18n: { namespaces: ['product:…'] }` — see [`../modules/MESSAGES.md`](../modules/MESSAGES.md)
5. Run `npm run modules:generate`

Packages: `npm run modules:sync` / `modules:wizard` align `@starforge/module-*` deps (see [module-install-packages](../../docs/project-context/docs/module-install-packages.md)).
