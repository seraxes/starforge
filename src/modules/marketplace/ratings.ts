/**
 * Marketplace ratings — member write + public average for seller block.
 * Pure rules stay in rating-rules.ts.
 *
 * Destination for migrated marketplace user ratings. Source-column map
 * stays TODO until an export exists (docs/ops/migration-users-events.md).
 */

import 'server-only'

import { and, eq } from 'drizzle-orm'

import { db } from '@/core/db'

import { getMarketplaceListing } from './listings'
import {
  decideMarketplaceHideRating,
  decideMarketplaceSubmitRating,
  isRatingDirection,
  publicRatingAverage,
  type MarketplaceRatingRecord,
  type RatingAcceptedOfferPair,
  type RatingDirection,
} from './rating-rules'
import {
  sfMarketplaceInquiries,
  sfMarketplaceOffers,
  sfMarketplaceRatings,
} from './schema'

function tableMissingMessage(error: unknown): string | null {
  const msg = error instanceof Error ? error.message : String(error)
  if (
    msg.includes('sf_marketplace_ratings') ||
    msg.includes('sf_marketplace_inquiries') ||
    msg.includes('sf_marketplace_offers') ||
    /does not exist|relation/i.test(msg)
  ) {
    return 'Marketplace rating tables missing — run npm run db:migrate.'
  }
  return null
}

function mapRatingRow(
  row: typeof sfMarketplaceRatings.$inferSelect,
): MarketplaceRatingRecord {
  const direction: RatingDirection = isRatingDirection(row.direction)
    ? row.direction
    : 'buyer_rates_seller'
  const score =
    typeof row.score === 'number' && Number.isFinite(row.score)
      ? Math.trunc(row.score)
      : 0
  return {
    id: row.id,
    fromUserId: (row.fromUserId || '').trim(),
    toUserId: (row.toUserId || '').trim(),
    listingId: (row.listingId || '').trim(),
    direction,
    score,
    note: (row.note || '').trim(),
    hidden: row.hidden === true,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function findMarketplaceRating(
  fromUserId: string,
  listingId: string,
  direction: RatingDirection,
): Promise<MarketplaceRatingRecord | null> {
  const from = String(fromUserId ?? '').trim()
  const lid = String(listingId ?? '').trim()
  if (!from || !lid || !isRatingDirection(direction)) return null
  try {
    const rows = await db
      .select()
      .from(sfMarketplaceRatings)
      .where(
        and(
          eq(sfMarketplaceRatings.fromUserId, from),
          eq(sfMarketplaceRatings.listingId, lid),
          eq(sfMarketplaceRatings.direction, direction),
        ),
      )
      .limit(1)
    const row = rows[0]
    return row ? mapRatingRow(row) : null
  } catch (error) {
    const missing = tableMissingMessage(error)
    if (missing) return null
    throw error
  }
}

export async function getMarketplaceRatingById(
  ratingId: string,
): Promise<MarketplaceRatingRecord | null> {
  const id = String(ratingId ?? '').trim()
  if (!id) return null
  try {
    const rows = await db
      .select()
      .from(sfMarketplaceRatings)
      .where(eq(sfMarketplaceRatings.id, id))
      .limit(1)
    const row = rows[0]
    return row ? mapRatingRow(row) : null
  } catch (error) {
    const missing = tableMissingMessage(error)
    if (missing) return null
    throw error
  }
}

/** Accepted-offer buyer/seller pairs for a listing (handoff eligibility). */
export async function listAcceptedOfferPairsForListing(
  listingId: string,
  sellerUserId: string,
): Promise<RatingAcceptedOfferPair[]> {
  const lid = String(listingId ?? '').trim()
  const seller = String(sellerUserId ?? '').trim()
  if (!lid) return []
  try {
    const inquiries = await db
      .select()
      .from(sfMarketplaceInquiries)
      .where(eq(sfMarketplaceInquiries.listingId, lid))
      .limit(200)
    if (inquiries.length === 0) return []

    const pairs: RatingAcceptedOfferPair[] = []
    for (const inquiry of inquiries) {
      const offers = await db
        .select()
        .from(sfMarketplaceOffers)
        .where(
          and(
            eq(sfMarketplaceOffers.inquiryId, inquiry.id),
            eq(sfMarketplaceOffers.status, 'accepted'),
          ),
        )
        .limit(1)
      if (offers.length === 0) continue
      const buyer = (inquiry.buyerUserId || '').trim()
      if (!buyer) continue
      pairs.push({
        buyerUserId: buyer,
        sellerUserId: seller,
      })
    }
    return pairs
  } catch (error) {
    const missing = tableMissingMessage(error)
    if (missing) return []
    throw error
  }
}

/** Non-hidden + hidden scores for a user (for public average). */
export async function listMarketplaceRatingsForUser(
  toUserId: string,
): Promise<MarketplaceRatingRecord[]> {
  const uid = String(toUserId ?? '').trim()
  if (!uid) return []
  try {
    const rows = await db
      .select()
      .from(sfMarketplaceRatings)
      .where(eq(sfMarketplaceRatings.toUserId, uid))
      .limit(2000)
    return rows.map(mapRatingRow)
  } catch (error) {
    const missing = tableMissingMessage(error)
    if (missing) return []
    throw error
  }
}

/**
 * Public average for a user, or null until 5 non-hidden ratings exist.
 */
export async function getPublicMarketplaceRatingAverage(
  toUserId: string,
): Promise<number | null> {
  const ratings = await listMarketplaceRatingsForUser(toUserId)
  return publicRatingAverage(ratings)
}

export type MarketplaceRatingEligibility = {
  canRate: boolean
  direction: RatingDirection | null
  toUserId: string | null
  alreadyRated: boolean
}

/**
 * Whether the viewer may rate the other party on this listing, and which way.
 */
export async function getMarketplaceRatingEligibility(
  listingId: string,
  viewerUserId: string,
): Promise<MarketplaceRatingEligibility> {
  const empty: MarketplaceRatingEligibility = {
    canRate: false,
    direction: null,
    toUserId: null,
    alreadyRated: false,
  }
  const lid = String(listingId ?? '').trim()
  const uid = String(viewerUserId ?? '').trim()
  if (!lid || !uid) return empty

  const listing = await getMarketplaceListing(lid)
  if (!listing) return empty

  const pairs = await listAcceptedOfferPairsForListing(lid, listing.sellerUserId)
  const soldTo = (listing.soldToUserId || '').trim()
  const seller = listing.sellerUserId

  let toUserId: string | null = null
  let direction: RatingDirection | null = null

  if (soldTo) {
    if (uid === soldTo) {
      toUserId = seller
      direction = 'buyer_rates_seller'
    } else if (uid === seller) {
      toUserId = soldTo
      direction = 'seller_rates_buyer'
    }
  }

  if (!direction) {
    for (const pair of pairs) {
      if (uid === pair.buyerUserId) {
        toUserId = pair.sellerUserId
        direction = 'buyer_rates_seller'
        break
      }
      if (uid === pair.sellerUserId) {
        toUserId = pair.buyerUserId
        direction = 'seller_rates_buyer'
        break
      }
    }
  }

  if (!direction || !toUserId) return empty

  const existing = await findMarketplaceRating(uid, lid, direction)
  return {
    canRate: !existing,
    direction,
    toUserId,
    alreadyRated: Boolean(existing),
  }
}

/** Submit a rating after a sold handoff or accepted offer. */
export async function submitMarketplaceRating(
  listingId: string,
  fromUserId: string,
  input: { toUserId: string; score: unknown; note?: unknown; direction?: unknown },
): Promise<{ rating: MarketplaceRatingRecord } | { error: string }> {
  const lid = String(listingId ?? '').trim()
  const from = String(fromUserId ?? '').trim()
  if (!from) return { error: 'Sign in to rate.' }
  if (!lid) return { error: 'Missing listing id.' }

  const listing = await getMarketplaceListing(lid)
  if (!listing) return { error: 'Listing not found.' }

  const pairs = await listAcceptedOfferPairsForListing(lid, listing.sellerUserId)
  const toUserId = String(input.toUserId ?? '').trim()
  const directionHint = isRatingDirection(input.direction)
    ? input.direction
    : null
  const existing = directionHint
    ? await findMarketplaceRating(from, lid, directionHint)
    : null

  // If direction not provided, probe both directions for an existing row.
  let existingForGate = existing
  if (!existingForGate) {
    const buyerExisting = await findMarketplaceRating(
      from,
      lid,
      'buyer_rates_seller',
    )
    const sellerExisting = await findMarketplaceRating(
      from,
      lid,
      'seller_rates_buyer',
    )
    existingForGate = buyerExisting || sellerExisting
  }

  const decision = decideMarketplaceSubmitRating(
    {
      id: listing.id,
      sellerUserId: listing.sellerUserId,
      soldToUserId: listing.soldToUserId,
    },
    {
      fromUserId: from,
      toUserId,
      score: input.score,
      note: input.note,
      direction: input.direction,
    },
    { acceptedOfferPairs: pairs, existing: existingForGate },
  )
  if (!decision.ok) return { error: decision.error }

  // Re-check unique direction after infer.
  const dup = await findMarketplaceRating(
    decision.rating.fromUserId,
    decision.rating.listingId,
    decision.rating.direction,
  )
  if (dup) {
    return { error: 'You already rated this listing in this direction.' }
  }

  try {
    await db.insert(sfMarketplaceRatings).values({
      id: decision.rating.id,
      fromUserId: decision.rating.fromUserId,
      toUserId: decision.rating.toUserId,
      listingId: decision.rating.listingId,
      direction: decision.rating.direction,
      score: decision.rating.score,
      note: decision.rating.note,
      hidden: decision.rating.hidden,
      createdAt: decision.rating.createdAt,
      updatedAt: decision.rating.updatedAt,
    })
    return { rating: decision.rating }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    const missing = tableMissingMessage(error)
    if (missing) return { error: missing }
    if (/unique|duplicate/i.test(msg)) {
      return { error: 'You already rated this listing in this direction.' }
    }
    throw error
  }
}

/** Staff hide a rating (excluded from public average). */
export async function hideMarketplaceRating(
  ratingId: string,
  actor: { userId: string; isStaff: boolean },
): Promise<{ rating: MarketplaceRatingRecord } | { error: string }> {
  const rating = await getMarketplaceRatingById(ratingId)
  const decision = decideMarketplaceHideRating(rating, {
    isStaff: actor.isStaff === true,
  })
  if (!decision.ok) return { error: decision.error }

  try {
    await db
      .update(sfMarketplaceRatings)
      .set({
        hidden: true,
        updatedAt: decision.rating.updatedAt,
      })
      .where(eq(sfMarketplaceRatings.id, decision.rating.id))
    return { rating: decision.rating }
  } catch (error) {
    const missing = tableMissingMessage(error)
    if (missing) return { error: missing }
    throw error
  }
}
