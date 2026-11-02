# Generated module registry

`module-registry.ts` is produced by `npm run modules:generate` from:

| Input | Role |
| --- | --- |
| [`starforge.modules.json`](../../starforge.modules.json) | Install/build allowlist (or env `SF_MODULES`) |
| [`src/modules/installable-manifest.ts`](../modules/installable-manifest.ts) | Known packs + dynamic import paths |

## Allowlist vs Site Settings toggle

| Layer | What it does |
| --- | --- |
| **Allowlist** (`starforge.modules.json`) | Which modules are *installed* in this build. Missing packs are omitted from generated `import()` loaders → not eager-bundled. |
| **Runtime toggle** (Site Settings → Modules) | On/off for *installed* modules only — palette, nav, public render. Does not remove code from disk/bundle. |

Required: `platform:better-auth`, `page-content` (always forced into the allowlist).

P2 (later): `@starforge/module-*` packages + `modules:sync` from GitHub Packages.
