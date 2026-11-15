/**
 * Module manifest contract (SF-141 / design-module-boundary M0).
 * Core hosts the type + `defineStarforgeModule`; packs contribute via
 * `src/modules/<id>/manifest.ts`. Codegen (`npm run modules:generate`) reads
 * manifests and writes `src/generated/module-registry.ts`.
 */

import type { ComponentType, ReactNode } from 'react'
import type { ZodType } from 'zod'

import type { FeatureFlags } from '@/core/settings/defaults'

/** Catalog / allowlist kinds used by Site Settings → Modules today. */
export type StarforgeModuleKind =
  | 'platform'
  | 'product'
  | 'particle'
  | 'atom'
  /** Design target for multi-particle packs (Search, Events, …). */
  | 'particle-pack'
  | 'hero'

/**
 * Pack direction for the boundary checker.
 * Base, advanced, and site packs set this. Core platform, builtin particle,
 * and atom rows omit it — they are not a pack direction.
 */
export type StarforgeModuleLayer = 'base' | 'advanced' | 'site'

export type StarforgeModuleNavView = {
  key: string
  label: string
  href: string
}

export type StarforgePublicShellSlot = 'head' | 'bodyStart' | 'bodyEnd'

/**
 * Node proxy hook (M3). Redirects is the reference pack.
 * Codegen reads `handlerImportPath` and emits a dynamic `import()` —
 * it does not execute the handler while generating.
 */
export type StarforgeModuleProxyDecl = {
  /** Lower runs first. Redirects uses 10. */
  order: number
  /** Codegen import path for the handler module. */
  handlerImportPath: string
  /** Named export; omit or `default` for the default export. */
  handlerExportName?: string
}

/**
 * Process-start hook. Codegen reads the path and does not call the export.
 */
export type StarforgeModuleBootDecl = {
  /** Codegen import path for the pack boot module. */
  importPath: string
  /** Named export on that module. */
  exportName: string
}

export type StarforgePublicShellContribution = {
  slot: StarforgePublicShellSlot
  /**
   * Codegen import path for the shell component (e.g. `@/modules/consent/public/ConsentShell`).
   * Required so `modules:generate` can emit a dynamic `import()` without executing the module.
   */
  importPath: string
  /** Named export; omit or `default` for default export. */
  exportName?: string
  /** Optional typed lazy pointer (not read by codegen). */
  component?: () => Promise<
    { default: ComponentType<Record<string, never>> } | ComponentType<Record<string, never>>
  >
}

export type StarforgeModuleParticleDecl = {
  id: string
  name: string
  defaultWidth?: number
  configSchema?: () => Promise<ZodType>
  defaults?: () => Record<string, unknown>
  render?: () => Promise<unknown>
  editor?: () => Promise<unknown>
  /** Codegen-visible schema import (preferred over lazy fn). */
  configSchemaImportPath?: string
  configSchemaExportName?: string
  /** Codegen-visible editor import (client component). */
  editorImportPath?: string
  editorExportName?: string
  /** Codegen-visible defaults() export. */
  defaultsImportPath?: string
  defaultsExportName?: string
}

export type StarforgeModuleAdminNavItem = {
  group: string
  label: string
  href: string
  order?: number
  area?: string
  exact?: boolean
}

/**
 * Admin App Router page contributed by a module (M2 route shims).
 * `path` is relative to `/admin/` (e.g. `media`, `media/settings`).
 * Codegen writes thin re-export shims under `app/admin/(modules)/…`.
 */
export type StarforgeModuleAdminRoute = {
  path: string
  /** Codegen-visible page import (Server Component). */
  pageImportPath: string
  /** Named export; omit or `default` for default export. */
  pageExportName?: string
}

/** Next route segment config copied into the generated shim as literals. */
export type StarforgeRouteSegmentConfig = {
  dynamic?: 'auto' | 'force-dynamic' | 'error' | 'force-static'
  runtime?: 'nodejs' | 'edge'
}

/**
 * Public App Router page or route handler owned by a pack (Stage 7).
 * Codegen writes a shim under a `(modules)` route group so the URL stays
 * the same. The shim is omitted when the pack is not on the allowlist.
 */
export type StarforgeModulePublicRoute = StarforgeRouteSegmentConfig & {
  /**
   * Path under the locale public tree (`events`, `account/profile`, `u/[handle]`)
   * or, when `root` is `frontend`, under `src/app/(frontend)/(modules)/`.
   */
  path: string
  /** `locale` (default) sits under `[locale]`. `frontend` is outside the locale prefix. */
  root?: 'locale' | 'frontend'
  /** `page` writes `page.tsx` (default). `route` writes `route.ts`. */
  file?: 'page' | 'route'
  pageImportPath: string
  /** Named export used as the page default. Omit or `default` for the default export. */
  pageExportName?: string
  /** Extra named exports to re-export (`metadata`, `generateMetadata`, `GET`, …). */
  reexport?: string[]
}

/**
 * API route handler owned by a pack (Stage 7).
 * Codegen writes `src/app/api/(modules)/<path>/route.ts`.
 */
export type StarforgeModuleApiRoute = StarforgeRouteSegmentConfig & {
  /** Path under `/api/`, e.g. `events/[eventId]/ics`. */
  path: string
  routeImportPath: string
  /** HTTP handlers to re-export: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS. */
  handlers: string[]
}

/**
 * Public module namespace the host loads by id from the generated server registry.
 * The import string lives in the generated file, so Core and host routes do not
 * name the pack. Omitted when the pack is not allowlisted.
 */
export type StarforgeModuleDoor = {
  id: string
  importPath: string
}

/**
 * Host page body loaded from the generated server registry.
 * The host file stays in `src/app` and does not import the pack. Codegen emits
 * the import only when the pack is allowlisted.
 */
export type StarforgeModuleHostPage = {
  /** Stable id the host calls, e.g. `account-events`. */
  id: string
  importPath: string
  exportName?: string
}

/** Realtime subscribe checker registered when the pack is allowlisted. */
export type StarforgeModuleRealtimeChannelAcl = {
  importPath: string
  exportName: string
}

/** Layout admin form-definition list, present only when the pack is allowlisted. */
export type StarforgeModuleLayoutFormCatalog = {
  importPath: string
  exportName: string
}

/**
 * Optional Site Settings topic panel contributed by a module (M2).
 * Document JSON lives in `sf_module_settings` keyed by module id.
 */
export type StarforgeModuleSettingsDecl = {
  topic: 'modules' | 'security' | 'performance' | 'auth' | string
  schemaImportPath?: string
  schemaExportName?: string
  defaultsImportPath?: string
  defaultsExportName?: string
  panelImportPath?: string
  panelExportName?: string
}

/**
 * Admin Dashboard widget contribution (D0+).
 * Mirror of `admin.nav` — codegen → `adminDashboardContributions` + server loaders.
 * Core host merges/filters by module toggle + ACL; soft-fails per widget.
 */
export type StarforgeModuleAdminDashboardWidget = {
  /** Stable id within the module, e.g. `users.strip` | `media.counts`. */
  id: string
  title: string
  /** Default 100; Core strip uses reserved order &lt; 50. */
  order?: number
  /**
   * Grid span. `sm` joins the compact insight row under user metrics.
   * `lg` spans the full mosaic width.
   */
  size?: 'sm' | 'md' | 'lg'
  /** ACL area key; omit = `admin.dashboard` only. */
  area?: string
  /** Codegen-visible Server Component that returns the card body. */
  widgetImportPath: string
  widgetExportName?: string
  /**
   * Optional JSON stats loader (preferred for SSR numbers / soft refresh).
   * Host may call when enabled; soft-fail → card shows “—” / retry.
   */
  statsImportPath?: string
  statsExportName?: string
}

export type StarforgeModuleManifest = {
  id: string
  kind: StarforgeModuleKind
  /**
   * Pack layer. Required on base, advanced, and site packs.
   * Omit on Core platform, builtin particle, and atom rows.
   */
  layer?: StarforgeModuleLayer
  label: string
  description: string
  version: string
  /** Locked on / always treated as installed when present in flavor. */
  required?: boolean
  defaultEnabled?: boolean
  /** Other module ids that should also be present (codegen drops if missing). */
  requires?: string[]
  /**
   * Integration the pack uses when that module is already enabled.
   * Unknown ids fail `modules:generate`. This list does not install or
   * enable the dependency, and turning the dependency off stays allowed.
   */
  optionalRequires?: string[]
  /**
   * Core builtin particle — registered from `@/core/modules/particles`,
   * not via dynamic import. Only meaningful for `kind: 'particle'`.
   */
  builtin?: boolean
  /** Legacy FeatureFlags bridge for product rows / notice-bar. */
  featureFlag?: keyof FeatureFlags
  /** Nav manager bindable views (also used for product admin deep-links). */
  navViews?: StarforgeModuleNavView[]
  /**
   * Dynamic import target for optional particles/atoms (M0 allowlist loaders).
   * Omitted for platform/product (catalog-only) and builtin particles.
   */
  importPath?: string
  exportName?: string
  /**
   * Flat particle schema/editor pointers (kind: 'particle').
   * Same codegen fields as `particles[]` entries — builtins use these.
   */
  configSchemaImportPath?: string
  configSchemaExportName?: string
  editorImportPath?: string
  editorExportName?: string
  defaultsImportPath?: string
  defaultsExportName?: string
  /** Optional admin nav + dashboard contributions (M2 / D0 host). */
  admin?: {
    nav?: StarforgeModuleAdminNavItem[]
    areas?: Array<{ key: string; label: string }>
    /** Group chrome when merging contributed nav (M2). */
    navGroup?: {
      id?: string
      label?: string
      href?: string
      expandable?: boolean
      defaultOpen?: boolean
      order?: number
    }
    /** Admin pages — codegen writes App Router shims (M2 leftovers). */
    routes?: StarforgeModuleAdminRoute[]
    /**
     * Dashboard widgets — codegen → registry; Core host at `/admin` merges
     * by allowlist + Site Settings toggle + ACL (no hardcoded product `if`s).
     */
    dashboard?: StarforgeModuleAdminDashboardWidget[]
  }
  /**
   * Module settings document + optional Site Settings topic panel (M2).
   * Storage: `sf_module_settings` (id = module id, document jsonb).
   */
  settings?: StarforgeModuleSettingsDecl
  /** Public layout shell slots (M2 host; Consent uses bodyEnd). */
  publicShell?: StarforgePublicShellContribution[]
  /**
   * Node proxy chain (M3). Codegen emits `proxyHookLoaders`; `src/proxy.ts`
   * runs `runProxyHooks` in `order`. Core does not import the pack.
   * `handlerImportPath` is the codegen-visible pointer (not executed here).
   */
  proxy?: StarforgeModuleProxyDecl
  /**
   * Process boot (Stage 6). Codegen emits `bootLoaders` and `runModuleBoot`
   * in `module-registry.server.ts`. `src/instrumentation.ts` calls that runner
   * and does not import the pack. The export must be idempotent and return
   * immediately when `isCatalogModuleEnabled` is false for this module id.
   * Disabled packs stay in the generated list; omitting them at build time
   * is a later stage.
   */
  boot?: StarforgeModuleBootDecl
  /**
   * Public pages and frontend route handlers. Codegen writes `(modules)` shims
   * only when this pack is allowlisted.
   */
  publicRoutes?: StarforgeModulePublicRoute[]
  /** API route handlers. Codegen writes `api/(modules)` shims when allowlisted. */
  apiRoutes?: StarforgeModuleApiRoute[]
  /**
   * Page bodies a host route loads by id. The import lives in the generated
   * server registry, not in `src/app`.
   */
  hostPages?: StarforgeModuleHostPage[]
  /** Module namespaces loaded by id from the generated server registry. */
  doors?: StarforgeModuleDoor[]
  /** Extra SSE channel checker. Omitted from the registry when this pack is not allowlisted. */
  realtimeChannelAcl?: StarforgeModuleRealtimeChannelAcl
  /** Layout manager form catalog. Absent from the registry when this pack is not allowlisted. */
  layoutFormCatalog?: StarforgeModuleLayoutFormCatalog
  /**
   * Side-effect CSS imports. Codegen writes them into `@/generated/module-styles`
   * only when this pack is allowlisted.
   */
  styles?: string[]
  /** Declared particles for particle-pack kind (M1+). */
  particles?: StarforgeModuleParticleDecl[]
  /** Drizzle schema path hint for later glob (M2+). */
  db?: { schema: string }
  /**
   * Optional UI message packs (i18n P3).
   * Prefer convention `src/modules/<folder>/messages/<locale>.json` discovered by
   * `modules:generate`. Declare `namespaces` (usually the module id, e.g.
   * `product:events`) so Core can merge only enabled packs into next-intl.
   * `load` is documentation/runtime-shaped — codegen emits import() loaders from
   * the messages directory and does not execute this function.
   */
  i18n?: StarforgeModuleI18nDecl
}

/** Module UI chrome messages — see `src/modules/MESSAGES.md`. */
export type StarforgeModuleI18nDecl = {
  /** Namespaces this pack owns (e.g. `['product:consent']`). */
  namespaces: string[]
  /**
   * Folder under the module root that holds `<locale>.json` files.
   * Default: `messages`.
   */
  messagesDir?: string
  /** Optional typed loader; codegen prefers the messagesDir convention. */
  load?: (locale: string) => Promise<Record<string, unknown>>
}

/** Identity helper — keeps manifests typed and discoverable. */
export function defineStarforgeModule<T extends StarforgeModuleManifest>(manifest: T): T {
  return manifest
}

/** Normalize a lazy publicShell import that may be default or named export. */
export type PublicShellComponent = ComponentType<Record<string, never>>

export type PublicShellRenderResult = ReactNode
