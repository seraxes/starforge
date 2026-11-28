/**
 * Marketplace listing → Social feed share.
 *
 * Advanced must not import advanced — load Social through the Core door slot
 * (`loadModuleDoor('social-api-server')` → `@/modules/social/api.server`).
 * Does not import Social store / schema / actions; does not write sf_social_* here.
 * Never mutates sf_marketplace_* — Social off / disabled leaves the listing unchanged.
 */

import 'server-only'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { getMarketplaceListing } from './listings'
import type { ListingActor } from './listing-rules'
import {
  shareMarketplaceListingThroughSocial,
  type MarketplaceSharePublishInput,
  type MarketplaceShareResult,
  type MarketplaceShareWriteResult,
} from './share-rules'

type SocialPublishDoor = {
  publishActivity: (input: {
    sourceModule: string
    sourceId: string
    activityKind: string
    actorUserId: string
    snapshot?: Record<string, unknown> | null
  }) => Promise<
    | { ok: true }
    | { ok: false; reason: 'disabled' | 'failed' | 'invalid' }
  >
}

async function isSocialModuleOn(): Promise<boolean> {
  try {
    const settings = await getSiteSettings()
    return isCatalogModuleEnabled(settings, MODULE_IDS.social)
  } catch {
    return false
  }
}

async function loadSocialPublishDoor(): Promise<SocialPublishDoor | null> {
  try {
    const { loadModuleDoor } = await import('@/generated/module-registry.server')
    const door = await loadModuleDoor('social-api-server')
    if (!door || typeof door.publishActivity !== 'function') return null
    return door as unknown as SocialPublishDoor
  } catch {
    return null
  }
}

async function publishThroughSocialDoor(
  input: MarketplaceSharePublishInput,
): Promise<MarketplaceShareWriteResult> {
  const door = await loadSocialPublishDoor()
  if (!door) return { ok: false, reason: 'disabled' }
  const result = await door.publishActivity({
    sourceModule: input.sourceModule,
    sourceId: input.sourceId,
    activityKind: input.activityKind,
    actorUserId: input.actorUserId,
    snapshot: input.snapshot,
  })
  if (result.ok) return { ok: true }
  return { ok: false, reason: result.reason }
}

/**
 * Seller / staff share: one activity card keyed by product:marketplace + listing id.
 * Repeat → same source key (Social upserts). Social off → fail-closed, no Marketplace write.
 */
export async function shareMarketplaceListingToFeed(
  listingId: string,
  actor: ListingActor,
): Promise<MarketplaceShareResult> {
  const id = String(listingId ?? '').trim()
  if (!id) {
    return { ok: false, reason: 'invalid', error: 'Missing listing id.' }
  }

  const listing = await getMarketplaceListing(id)
  if (!listing) {
    return { ok: false, reason: 'invalid', error: 'Listing not found.' }
  }

  const socialEnabled = await isSocialModuleOn()

  return shareMarketplaceListingThroughSocial(
    { socialEnabled },
    actor,
    {
      id: listing.id,
      sellerUserId: listing.sellerUserId,
      title: listing.title,
      mediaIds: listing.mediaIds,
    },
    publishThroughSocialDoor,
  )
}
