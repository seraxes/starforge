/**
 * Aggregated module manifests for `npm run modules:generate`.
 * Packs export `defineStarforgeModule(...)` from `src/modules/<id>/manifest.ts`;
 * Core-owned rows come from `hostModuleManifests`.
 */

import { hostModuleManifests } from '@/core/modules/host-manifests'
import type { StarforgeModuleManifest } from '@/core/modules/define-module'

import consentManifest from './consent/manifest'
import formParticleManifest from './form/manifest'
import formsManifest from './forms/manifest'
import noticeBarManifest from './notice-bar/manifest'
import redirectsManifest from './redirects/manifest'
import searchManifest from './search/manifest'
import searchParticleManifest from './search/particle-manifest'

/** All installable manifests (host + packs). Source of truth for codegen. */
export const ALL_MODULE_MANIFESTS: StarforgeModuleManifest[] = [
  ...hostModuleManifests,
  formsManifest,
  redirectsManifest,
  consentManifest,
  searchManifest,
  noticeBarManifest,
  formParticleManifest,
  searchParticleManifest,
]

export function getModuleManifest(id: string): StarforgeModuleManifest | undefined {
  return ALL_MODULE_MANIFESTS.find((entry) => entry.id === id)
}
