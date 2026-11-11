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
  /** Grid span hint — `lg` spans full width on desktop mosaic. */
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
  label: string
  description: string
  version: string
  /** Locked on / always treated as installed when present in flavor. */
  required?: boolean
  defaultEnabled?: boolean
  /** Other module ids that should also be present (codegen drops if missing). */
  requires?: string[]
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
