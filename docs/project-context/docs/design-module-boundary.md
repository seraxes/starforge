---
cursor:
  subagentId: "bc-0ab719b5-2646-52f8-8a6c-6069013cc077"
---

# Starforge design — module boundary (manifest contract)

**Status:** target design. Goal: the next packs (Consent → Search → Events → Maps …) are added **without editing `src/core`**. This complements [module-toggle-architecture](./module-toggle-architecture.md) (allowlist/packages) and [replaceable-modularity-plan](./replaceable-modularity-plan.md) (ports vs modules). Overview: [design-system-overview](./design-system-overview.md).

## 1. Why (evidence)

| PR | Pack | Core files touched |
| --- | --- | --- |
| [#79](https://github.com/seraxes/starforge/pull/79) | Redirects + sitemap | `admin-nav/build.ts` + types, `settings/module-catalog.ts` + `module-toggles.ts`, `modules/installable-manifest.ts`, `db/schema.ts`, `middleware.ts`, `acl/types.ts`, `site-chrome/*`, `core/index.ts`, Payload nav, admin layout (~30 files) |
| [#81](https://github.com/seraxes/starforge/pull/81) | Consent | `site-chrome/{types,defaults,normalize,actions,index}`, `page-settings/{document-shell,atoms/analytics}`, public layout, both catalogs (~23 files) |
| Existing | Form / Logo / Menu / Social particles | Per-particle `update*SlotAction` in `core/modules/actions.ts`, `switch` in `particles/config.ts`, 967-line `typed-particle-editors.tsx` |

There are two hand-maintained catalogs (`installable-manifest.ts`, `PRODUCT_MODULE_CATALOG`), and Core imports `@/modules/catalog` (the dependency points the wrong way).

## 2. Principles

- **Static, typed, codegen.** No runtime plugin loader, no DI container. `modules:generate` reads manifests and writes `src/generated/*`.
- **Manifests are light.** They contain only metadata plus lazy `() => import()` pointers, so Core can read every manifest without bundling every module.
- **One catalog.** Site Settings → Modules, the allowlist, nav views, the env editor, and ACL areas are all derived from manifests.
- **Core hosts, modules contribute.** Core owns extension points; modules fill them.

## 3. Folder layout

```
src/modules/<id>/
  manifest.ts        // defineStarforgeModule({...}) — the only file codegen imports eagerly
  api.ts             // public API other modules may import (e.g. forms: registerFormPreset)
  server/            // actions, stores, services
  admin/             // admin pages/components (route shims point here)
  public/            // particles, public-shell components
  schema.ts          // Drizzle tables sf_<id>_* (optional)
  README.md
```

## 4. Contract

```ts
export type StarforgeModuleManifest = {
  id: string                       // 'product:consent' | 'product:redirects' | 'product:events' …
  kind: 'product' | 'particle-pack' | 'hero'
  label: string
  description: string
  version: string
  required?: boolean               // locked on (e.g. Media library used by Logo)
  defaultEnabled?: boolean
  requires?: string[]              // other module ids (codegen errors if missing)

  particles?: Array<{
    id: string
    name: string
    defaultWidth?: number
    configSchema: () => Promise<ZodType>        // validate + normalize slot config
    defaults: () => Record<string, unknown>
    render: () => Promise<ParticleRender>       // public render
    editor?: () => Promise<ParticleEditor>      // admin cog panel (client component)
  }>
  atoms?: Array<{ type: string; load: () => Promise<StarforgeAtomDefinition> }>

  admin?: {
    nav?: Array<{ group: string; label: string; href: string; order?: number; area?: string }>
    routes?: Array<{ path: string; page: () => Promise<AdminPage> }>  // → generated route shims
    areas?: Array<{ key: string; label: string }>                    // ACL matrix rows
  }
  settings?: {
    topic: 'modules' | 'security' | 'performance' | 'auth' | string
    schema: () => Promise<ZodType>
    defaults: () => Record<string, unknown>
    panel: () => Promise<SettingsPanel>
  }
  publicShell?: Array<{ slot: 'head' | 'bodyStart' | 'bodyEnd'; component: () => Promise<ShellComponent> }>
  proxy?: { order: number; handler: () => Promise<ProxyHandler> }    // e.g. redirects
  publicRoutes?: Array<{ path: string; handler: () => Promise<RouteHandler> }> // e.g. sitemap provider
  sitemap?: () => Promise<SitemapProvider>
  navViews?: Array<{ key: string; label: string; href: string }>     // Nav manager bindable views
  csp?: CspContribution            // origins per directive, conditional on settings
  permissions?: Partial<Record<'geolocation' | 'camera' | 'microphone', 'self'>>
  env?: EnvEditorField[]           // keys this module needs (non-secret flags + secret names)
  db?: { schema: string }          // path to schema.ts for drizzle config glob
}

export const defineStarforgeModule = (m: StarforgeModuleManifest) => m
```

### Core host responsibilities

| Extension point | Core host | Replaces today |
| --- | --- | --- |
| Particle config save | One generic `updateSlotConfigAction(layoutId, slotId, json)` that validates with the module's `configSchema` | `updateLogo/Menu/Copyright/Social/FormSlotAction` |
| Particle editor | Cog popover loads `editor()` by `moduleId` | `typed-particle-editors.tsx` switch |
| Admin nav | `buildAdminNavGroups` merges `admin.nav` (filtered by toggle + area) | Hardcoded `if (flags.forms)` blocks |
| Admin routes | Codegen writes `src/app/(frontend)/app/admin/(modules)/<id>/[[...slug]]/page.tsx` shims → `admin.routes` | Hand-written route folders per pack |
| Module settings | Generic `sf_module_settings (id text pk, document jsonb, updated_at)` + Settings topic host renders `panel()` | New fields on Site Chrome / per-module tables |
| Public shell | Public layout renders `publicShell` components by slot | Public layout importing Consent directly |
| Proxy chain | `proxy.ts` runs `proxy` handlers by `order` (in-process, cached) | Middleware `fetch` to `/api/redirects/lookup` |
| Sitemap | `app/sitemap.ts` concatenates providers | Core sitemap knowing every content type |
| CSP / Permissions | Security policy composer merges contributions | Static header string |
| Env editor | Catalog = Core keys + module `env` | Hand-edited `env-editor/catalog.ts` |
| DB | Drizzle `schema: ['src/core/db/schema.ts', 'src/modules/*/schema.ts']` | All tables in `core/db/schema.ts` |

## 5. Dependency rules (enforced by ESLint `no-restricted-imports`)

1. `src/core/**` must not import `@/modules/**`. It may import `@/generated/*` only.
2. Modules import Core through public surfaces (`@/core`, `@/core/<port>`), not deep internals of other Core areas.
3. Module → module only via `@/modules/<other>/api` and only when listed in `requires`.
4. Hero → modules via `api.ts` + declared extension points; never deep imports.

## 6. Cross-module seams (keep few)

- **Form presets:** `forms/api.ts` exports `registerFormPreset({ id, label, seedFields, onSubmitted? })`. Events registration = preset + `onSubmitted` (capacity check, confirmation mail). Never a second builder.
- **Media binds:** `media/api.ts` exports `resolveMediaById`, `MediaPicker`, and tag/category filters. One library.
- **Entity extensions (Hero, later):** modules may declare `extends: { 'events.event': ZodType }`, stored in a namespaced `extensions jsonb` column. Hero manifests fill them. Decide shape when Events ships.
- **Typed hooks** only where two real consumers exist; no generic event bus up front.

## 7. Data-home rule for modules

| Data kind | Home |
| --- | --- |
| Editorial (rich text, drafts/versions, media galleries; editors use Payload) | Payload collection contributed by the module (Payload config plugin) |
| Transactional / high-write / queried (submissions, registrations, votes, location shares, redirects) | Drizzle `sf_<id>_*`, `jsonb` for queried JSON |
| Module settings | `sf_module_settings` |
| Secrets | env only |

## 8. Migration plan (incremental, no big-bang)

| Step | Scope | Done when |
| --- | --- | --- |
| **M0** | Types + `defineStarforgeModule`; codegen reads manifests for existing entries; derive **one** catalog; delete `PRODUCT_MODULE_CATALOG` duplication; invert Core → `@/modules/catalog` via generated registry | Behavior unchanged; one catalog |
| **M1** | Generic `updateSlotConfigAction` + editor loader; port Logo/Menu/Copyright/Social/Form particle configs to `configSchema` + `editor` | `core/modules/actions.ts` has no per-particle actions |
| **M2** | Admin nav + route shims + `sf_module_settings` + public-shell slots + proxy chain | Consent and Redirects contribute via manifest |
| **M3** | Consent ([#81](https://github.com/seraxes/starforge/pull/81), merge as-is) and Redirects (#79) become reference modules under `src/modules/{consent,redirects}` | Their Core files deleted or moved |
| **M4** | Forms: admin + particle + settings + schema → `src/modules/forms`; engine (`types/expr/logic/evaluate`) exported from `forms/api.ts` | `src/core/forms` gone; Events can use `registerFormPreset` |
| **M5** | Media library UI → `src/modules/media` (`required: true`); `MediaStorage` port stays Core | Media appears in Modules list as locked |

**Acceptance test for every new pack (Search, Events, Maps…):** the PR diff touches only `src/modules/<id>/**`, `starforge.modules.json`, `src/generated/**`, and migrations. CI's minimal-flavor build (see [design-data-deploy](./design-data-deploy.md) §6) proves Core compiles without it.

## 9. Non-goals

- Runtime install/hot-download of modules (prefer deploy-time sync, per toggle architecture).
- Per-module separate Next apps or micro-frontends.
- Abstracting Payload/Better Auth behind module-facing adapters.
- Moving `src/core/forms` before M0–M2 exist (it would only relocate the coupling).
