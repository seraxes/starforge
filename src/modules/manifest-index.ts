/**
 * Aggregated module manifests for `npm run modules:generate`.
 * Packs export `defineStarforgeModule(...)` from `src/modules/<id>/manifest.ts`;
 * Core-owned rows come from `hostModuleManifests`.
 */

import { hostModuleManifests } from '@/core/modules/host-manifests'
import type { StarforgeModuleManifest } from '@/core/modules/define-module'

import consentManifest from './consent/manifest'
import emailManagerManifest from './email-manager/manifest'
import paymentsManifest from './payments/manifest'
import subscriptionsManifest from './subscriptions/manifest'
import subscriptionPlansParticleManifest from './subscriptions/particles/subscription-plans-manifest'
import eventsManifest from './events/manifest'
import eventCalendarParticleManifest from './events/particles/event-calendar-manifest'
import eventCountdownParticleManifest from './events/particles/event-countdown-manifest'
import eventDetailParticleManifest from './events/particles/event-detail-manifest'
import eventFeaturedParticleManifest from './events/particles/event-featured-manifest'
import eventListParticleManifest from './events/particles/event-list-manifest'
import eventMiniCalendarParticleManifest from './events/particles/event-mini-calendar-manifest'
import eventUpcomingParticleManifest from './events/particles/event-upcoming-manifest'
import formParticleManifest from './form/manifest'
import formsManifest from './forms/manifest'
import mapsManifest from './maps/manifest'
import mapParticleManifest from './maps/particle-manifest'
import liveMapParticleManifest from './maps/live-map-particle-manifest'
import marketplaceManifest from './marketplace/manifest'
import mediaManifest from './media/manifest'
import pagesManifest from './pages/manifest'
import noticeBarManifest from './notice-bar/manifest'
import pwaManifest from './pwa/manifest'
import profilesManifest from './profiles/manifest'
import redirectsManifest from './redirects/manifest'
import lexicalEditorManifest from './lexical-editor/manifest'
import auditManifest from './audit/manifest'
import richEditorManifest from './rich-editor/manifest'
import searchManifest from './search/manifest'
import searchParticleManifest from './search/particle-manifest'
import socialManifest from './social/manifest'
import socialFriendsParticleManifest from './social/particles/social-friends-manifest'
import socialGroupsParticleManifest from './social/particles/social-groups-manifest'
import socialPagesParticleManifest from './social/particles/social-pages-manifest'
import socialStoriesParticleManifest from './social/particles/social-stories-manifest'
import adsManifest from './ads/manifest'

/** All installable manifests (host + packs). Source of truth for codegen. */
export const ALL_MODULE_MANIFESTS: StarforgeModuleManifest[] = [
  ...hostModuleManifests,
  formsManifest,
  richEditorManifest,
  lexicalEditorManifest,
  emailManagerManifest,
  paymentsManifest,
  subscriptionsManifest,
  subscriptionPlansParticleManifest,
  eventsManifest,
  eventListParticleManifest,
  eventUpcomingParticleManifest,
  eventCalendarParticleManifest,
  eventFeaturedParticleManifest,
  eventMiniCalendarParticleManifest,
  eventDetailParticleManifest,
  eventCountdownParticleManifest,
  profilesManifest,
  socialManifest,
  socialFriendsParticleManifest,
  socialGroupsParticleManifest,
  socialPagesParticleManifest,
  socialStoriesParticleManifest,
  adsManifest,
  mapsManifest,
  mapParticleManifest,
  liveMapParticleManifest,
  marketplaceManifest,
  redirectsManifest,
  auditManifest,
  consentManifest,
  pwaManifest,
  searchManifest,
  mediaManifest,
  pagesManifest,
  noticeBarManifest,
  formParticleManifest,
  searchParticleManifest,
]

export function getModuleManifest(id: string): StarforgeModuleManifest | undefined {
  return ALL_MODULE_MANIFESTS.find((entry) => entry.id === id)
}
