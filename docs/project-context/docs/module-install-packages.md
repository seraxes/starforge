# Module install: Core + GitHub Packages

**Target (2026-11-10):** the installer is this flow. A site download contains the host plus the packs that were chosen. Unchosen modules are not on disk. See [architecture-current](./architecture-current.md). Today `modules:sync` only adds or removes `@starforge/module-*` dependencies, and only notice-bar and consent are real packages. Engines that still live in `src/core` (Forms, media, redirects, editors, search, payments, maps) are downloaded with every install.

How Starforge stays modular at **install time** without conflating that with runtime toggles.

## Three layers (do not mix)

| Layer | When | Mechanism | Effect |
| --- | --- | --- | --- |
| **1. Install / sync** | Setup or deploy | `starforge.modules.json` → `npm run modules:sync` | Adds/removes `@starforge/module-*` deps (GitHub Packages or local `packages/`) so unused packs are not on disk |
| **2. Generate** | `predev` / `prebuild` | `npm run modules:generate` | Writes `src/generated/module-registry*.ts` with `import()` loaders only for allowlisted ids |
| **3. Runtime toggle** | Admin | Site Settings → **Modules** | On/off for *installed* packs — nav, palette, public render. Does **not** uninstall code |

Mental model for operators:

1. Clone / image **Starforge Core**
2. Choose modules (edit JSON or `npm run modules:wizard`)
3. Sync pulls **only** those packages
4. Migrate, seed, run
5. Optionally disable an installed module in Site Settings without a rebuild

## Why GitHub Packages (not git-clone per module)

| Concern | Packages | Per-module git clone |
| --- | --- | --- |
| Version pin | semver + lockfile | commit SHAs / branches |
| Auth | `NODE_AUTH_TOKEN` → `npm.pkg.github.com` | deploy keys per repo |
| Lean image | `npm ci` only listed deps | sparse checkouts / submodules |
| Tooling | same as npm | custom scripts |

Private registry: **GitHub Packages** under the `@starforge` scope. See root `.npmrc.example`.

## Allowlist file

[`starforge.modules.json`](../../../starforge.modules.json):

- `flavor` — active preset name (`core`, `lean`, …)
- `presets` — named id lists; generate/sync use `presets[flavor]` when present
- `modules` — fallback list when the flavor has no preset
- `registryPackages` — map allowlist id → npm package (`name`, `version`, `localPath`)

Override for one run: `SF_MODULES=id1,id2,... npm run modules:generate`.

## Commands

| Script | Role |
| --- | --- |
| `npm run modules:wizard` | Interactive pick → writes allowlist → runs sync |
| `npm run modules:sync` | Align `package.json` deps with allowlist + registryPackages → `npm install` → `modules:generate` |
| `npm run modules:generate` | Codegen only (also `predev` / `prebuild`) |

## Local vs published packages

- **Monorepo / local:** `modules:sync` prefers `file:<localPath>` (see `packages/module-*`).
- **Deploy without monorepo packages tree:** set `STARFORGE_MODULE_SOURCE=registry` and `NODE_AUTH_TOKEN` so sync installs published `@starforge/module-*` versions from GitHub Packages.

## First extracted packs

| Allowlist id | Package | Notes |
| --- | --- | --- |
| `notice-bar` | `@starforge/module-notice-bar` | Self-contained particle UI |
| `product:consent` | `@starforge/module-consent` | Banner + cookie helpers; app keeps thin `ConsentShell` host adapter |

## Related

- [module-toggle-architecture](./module-toggle-architecture.md)
- [replaceable-modularity-plan](./replaceable-modularity-plan.md)
- [design-module-boundary](./design-module-boundary.md)
- [`src/modules/README.md`](../../../src/modules/README.md)
