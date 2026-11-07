/**
 * Aggregated module manifests for `npm run modules:generate`.
 * Packs export `defineStarforgeModule(...)` from `src/modules/<id>/manifest.ts`;
 * Core-owned rows come from `hostModuleManifests`.
 */

import { hostModuleManifests } from '@/core/modules/host-manifests'
import type { StarforgeModuleManifest } from '@/core/modules/define-module'

import consentManifest from './consent/manifest'
import emailManagerManifest from './email-manager/manifest'
import eventsManifest from './events/manifest'
import eventCountdownParticleManifest from './events/particles/event-countdown-manifest'
import eventDetailParticleManifest from './events/particles/event-detail-manifest'
import eventListParticleManifest from './events/particles/event-list-manifest'
import formParticleManifest from './form/manifest'
import formsManifest from './forms/manifest'
import mapsManifest from './maps/manifest'
import mapParticleManifest from './maps/particle-manifest'
import marketplaceManifest from './marketplace/manifest'
import mediaManifest from './media/manifest'
import noticeBarManifest from './notice-bar/manifest'
import pwaManifest from './pwa/manifest'
import redirectsManifest from './redirects/manifest'
import lexicalEditorManifest from './lexical-editor/manifest'
import richEditorManifest from './rich-editor/manifest'
import searchManifest from './search/manifest'
import searchParticleManifest from './search/particle-manifest'

/** All installable manifests (host + packs). Source of truth for codegen. */
export const ALL_MODULE_MANIFESTS: StarforgeModuleManifest[] = [
  ...hostModuleManifests,
  formsManifest,
  richEditorManifest,
  lexicalEditorManifest,
  emailManagerManifest,
  eventsManifest,
  eventListParticleManifest,
  eventDetailParticleManifest,
  eventCountdownParticleManifest,
  mapsManifest,
  mapParticleManifest,
  marketplaceManifest,
  redirectsManifest,
  consentManifest,
  pwaManifest,
  searchManifest,
  mediaManifest,
  noticeBarManifest,
  formParticleManifest,
  searchParticleManifest,
]

export function getModuleManifest(id: string): StarforgeModuleManifest | undefined {
  return ALL_MODULE_MANIFESTS.find((entry) => entry.id === id)
}
