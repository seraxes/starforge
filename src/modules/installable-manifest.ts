/**
 * Back-compat surface for codegen / docs that still say "installable manifest".
 * Source of truth is `defineStarforgeModule` entries aggregated in `manifest-index.ts`.
 */

import type { StarforgeModuleManifest } from '@/core/modules/define-module'

import { ALL_MODULE_MANIFESTS, getModuleManifest } from './manifest-index'

export type InstallableKind = StarforgeModuleManifest['kind']

export type InstallableNavView = {
  key: string
  label: string
  href: string
}

export type InstallableEntry = StarforgeModuleManifest

/** @deprecated Prefer ALL_MODULE_MANIFESTS — kept as the historical export name. */
export const INSTALLABLE_MANIFEST: InstallableEntry[] = ALL_MODULE_MANIFESTS

export function getInstallableEntry(id: string): InstallableEntry | undefined {
  return getModuleManifest(id)
}

export { ALL_MODULE_MANIFESTS, getModuleManifest }
