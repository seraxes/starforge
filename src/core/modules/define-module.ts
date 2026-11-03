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
}

export type StarforgeModuleAdminNavItem = {
  group: string
  label: string
  href: string
  order?: number
  area?: string
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
  /** Optional admin nav contributions (M2 host). */
  admin?: {
    nav?: StarforgeModuleAdminNavItem[]
    areas?: Array<{ key: string; label: string }>
  }
  /** Public layout shell slots (M2 host; Consent uses bodyEnd). */
  publicShell?: StarforgePublicShellContribution[]
  /** Declared particles for particle-pack kind (M1+). */
  particles?: StarforgeModuleParticleDecl[]
  /** Drizzle schema path hint for later glob (M2+). */
  db?: { schema: string }
}

/** Identity helper — keeps manifests typed and discoverable. */
export function defineStarforgeModule<T extends StarforgeModuleManifest>(manifest: T): T {
  return manifest
}

/** Normalize a lazy publicShell import that may be default or named export. */
export type PublicShellComponent = ComponentType<Record<string, never>>

export type PublicShellRenderResult = ReactNode
