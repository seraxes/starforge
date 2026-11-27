/**
 * Pure Marketplace → Social feed-share rules.
 * Store / actions call these; unit tests hit this module without DB or Social.
 *
 * One card per listing via (sourceModule, sourceId, activityKind).
 * Social off → fail-closed; the write is never called; no Marketplace row changes.
 */

import type { ListingActor } from './listing-rules'

export const MARKETPLACE_SHARE_SOURCE_MODULE = 'product:marketplace' as const
export const MARKETPLACE_SHARE_ACTIVITY_KIND = 'listing.shared' as const

export type MarketplaceShareSourceKey = {
  sourceModule: typeof MARKETPLACE_SHARE_SOURCE_MODULE
  sourceId: string
  activityKind: typeof MARKETPLACE_SHARE_ACTIVITY_KIND
}

export type MarketplaceShareListing = {
  id: string
  sellerUserId: string
  title: string
  mediaIds: string[]
}

export type MarketplaceSharePublishInput = MarketplaceShareSourceKey & {
  actorUserId: string
  snapshot: {
    title: string
    href: string
    mediaId?: string
  }
}

export type MarketplaceShareWriteResult =
  | { ok: true }
  | { ok: false; reason: 'disabled' | 'failed' | 'invalid' }

export type MarketplaceShareResult =
  | { ok: true; sourceKey: MarketplaceShareSourceKey }
  | { ok: false; reason: 'disabled' | 'failed' | 'invalid' | 'forbidden'; error: string }

/** Stable Social activity key for one listing. Repeat shares reuse this key. */
export function marketplaceListingShareSourceKey(
  listingId: string,
): MarketplaceShareSourceKey | null {
  const sourceId = String(listingId ?? '').trim()
  if (!sourceId) return null
  return {
    sourceModule: MARKETPLACE_SHARE_SOURCE_MODULE,
    sourceId,
    activityKind: MARKETPLACE_SHARE_ACTIVITY_KIND,
  }
}

/** Seller or Marketplace staff may share. */
export function canShareMarketplaceListing(
  actor: ListingActor,
  listing: Pick<MarketplaceShareListing, 'sellerUserId'>,
): boolean {
  const userId = String(actor.userId ?? '').trim()
  if (!userId) return false
  if (actor.isStaff) return true
  return userId === String(listing.sellerUserId ?? '').trim()
}

/** Build the publishActivity payload. Same listing → same source key every time. */
export function buildMarketplaceListingShareInput(
  listing: MarketplaceShareListing,
  actorUserId: string,
): MarketplaceSharePublishInput | null {
  const key = marketplaceListingShareSourceKey(listing.id)
  const actor = String(actorUserId ?? '').trim()
  if (!key || !actor) return null
  const title = String(listing.title ?? '').trim() || 'Marketplace listing'
  const mediaId = Array.isArray(listing.mediaIds)
    ? String(listing.mediaIds[0] ?? '').trim() || undefined
    : undefined
  return {
    ...key,
    actorUserId: actor,
    snapshot: {
      title,
      href: `/marketplace/${key.sourceId}`,
      ...(mediaId ? { mediaId } : {}),
    },
  }
}

/**
 * Share a listing to the Social feed through an injected write.
 * Social off → `{ reason: 'disabled' }` and `write` is not called.
 * A second share uses the same source key (Social upserts; no second card).
 */
export async function shareMarketplaceListingThroughSocial(
  gates: { socialEnabled: boolean },
  actor: ListingActor,
  listing: MarketplaceShareListing,
  write: (input: MarketplaceSharePublishInput) => Promise<MarketplaceShareWriteResult>,
): Promise<MarketplaceShareResult> {
  if (!canShareMarketplaceListing(actor, listing)) {
    return {
      ok: false,
      reason: 'forbidden',
      error: 'Only the seller or Marketplace staff may share this listing.',
    }
  }

  const input = buildMarketplaceListingShareInput(listing, actor.userId)
  if (!input) {
    return { ok: false, reason: 'invalid', error: 'Missing listing or actor.' }
  }

  const sourceKey: MarketplaceShareSourceKey = {
    sourceModule: input.sourceModule,
    sourceId: input.sourceId,
    activityKind: input.activityKind,
  }

  if (!gates.socialEnabled) {
    return {
      ok: false,
      reason: 'disabled',
      error: 'Social is disabled. Enable it under Settings → Modules to share.',
    }
  }

  const written = await write(input)
  if (!written.ok) {
    if (written.reason === 'disabled') {
      return {
        ok: false,
        reason: 'disabled',
        error: 'Social is disabled. Enable it under Settings → Modules to share.',
      }
    }
    if (written.reason === 'invalid') {
      return { ok: false, reason: 'invalid', error: 'Could not share this listing.' }
    }
    return {
      ok: false,
      reason: 'failed',
      error: 'Could not share to the feed. Try again later.',
    }
  }

  return { ok: true, sourceKey }
}
