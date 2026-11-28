/**
 * Pure marketplace rating rules.
 * Store and actions call these; unit tests hit this module without DB.
 * No db import. Public average is null until 5 non-hidden ratings exist.
 */

export const RATING_DIRECTIONS = ['buyer_rates_seller', 'seller_rates_buyer'] as const
export type RatingDirection = (typeof RATING_DIRECTIONS)[number]

/** Non-hidden ratings required before the average is public. */
export const PUBLIC_RATING_THRESHOLD = 5

export type MarketplaceRatingRecord = {
  id: string
  fromUserId: string
  toUserId: string
  listingId: string
  direction: RatingDirection
  score: number
  note: string
  hidden: boolean
  createdAt: Date
  updatedAt: Date
}

/** Listing fields needed for handoff checks. */
export type RatingListingHandoff = {
  id: string
  sellerUserId: string
  soldToUserId: string | null
}

/** Accepted-offer pair on a listing (buyer + seller). */
export type RatingAcceptedOfferPair = {
  buyerUserId: string
  sellerUserId: string
}

export type RatingSubmitDecision =
  | { ok: true; rating: MarketplaceRatingRecord }
  | { ok: false; error: string }

export type RatingHideDecision =
  | { ok: true; rating: MarketplaceRatingRecord }
  | { ok: false; error: string }

export function isRatingDirection(value: unknown): value is RatingDirection {
  return (
    typeof value === 'string' &&
    (RATING_DIRECTIONS as readonly string[]).includes(value)
  )
}

function asTrimmed(raw: unknown): string {
  return String(raw ?? '').trim()
}

function parseScore(raw: unknown): number | null {
  const n =
    typeof raw === 'number' ? raw : Number(String(raw ?? '').trim())
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null
  return n
}

/**
 * A rating is eligible only when soldToUserId is the other party,
 * or an accepted offer on that listing joins the same pair.
 */
export function isRatingHandoffEligible(
  listing: RatingListingHandoff,
  fromUserId: string,
  toUserId: string,
  acceptedOfferPairs: RatingAcceptedOfferPair[],
): boolean {
  const from = asTrimmed(fromUserId)
  const to = asTrimmed(toUserId)
  const seller = asTrimmed(listing.sellerUserId)
  if (!from || !to || !seller) return false
  if (from === to) return false

  const soldTo = asTrimmed(listing.soldToUserId || '')
  if (soldTo) {
    const soldPair =
      (from === soldTo && to === seller) || (from === seller && to === soldTo)
    if (soldPair) return true
  }

  for (const pair of acceptedOfferPairs) {
    const buyer = asTrimmed(pair.buyerUserId)
    const offerSeller = asTrimmed(pair.sellerUserId) || seller
    if (!buyer) continue
    if (
      (from === buyer && to === offerSeller) ||
      (from === offerSeller && to === buyer)
    ) {
      return true
    }
  }

  return false
}

/**
 * Infer direction from roles on the listing / accepted offer pair.
 * Buyer → seller = buyer_rates_seller; seller → buyer = seller_rates_buyer.
 */
export function inferRatingDirection(
  listing: RatingListingHandoff,
  fromUserId: string,
  toUserId: string,
  acceptedOfferPairs: RatingAcceptedOfferPair[],
): RatingDirection | null {
  const from = asTrimmed(fromUserId)
  const to = asTrimmed(toUserId)
  const seller = asTrimmed(listing.sellerUserId)
  if (!from || !to || !seller) return null

  const soldTo = asTrimmed(listing.soldToUserId || '')
  if (soldTo) {
    if (from === soldTo && to === seller) return 'buyer_rates_seller'
    if (from === seller && to === soldTo) return 'seller_rates_buyer'
  }

  for (const pair of acceptedOfferPairs) {
    const buyer = asTrimmed(pair.buyerUserId)
    const offerSeller = asTrimmed(pair.sellerUserId) || seller
    if (!buyer) continue
    if (from === buyer && to === offerSeller) return 'buyer_rates_seller'
    if (from === offerSeller && to === buyer) return 'seller_rates_buyer'
  }

  return null
}

/**
 * Submit a rating after a handoff. Score must be 1–5.
 * A second rating in the same direction for the same listing is refused.
 */
export function decideMarketplaceSubmitRating(
  listing: RatingListingHandoff,
  input: {
    fromUserId: string
    toUserId: string
    score: unknown
    note?: unknown
    direction?: unknown
  },
  gates: {
    acceptedOfferPairs: RatingAcceptedOfferPair[]
    /** Existing rating for this (from, listing, direction), if any. */
    existing: MarketplaceRatingRecord | null
  },
  opts?: { now?: Date; newId?: () => string },
): RatingSubmitDecision {
  const fromUserId = asTrimmed(input.fromUserId)
  const toUserId = asTrimmed(input.toUserId)
  if (!fromUserId) return { ok: false, error: 'Sign in to rate.' }
  if (!toUserId) return { ok: false, error: 'Missing ratee.' }
  if (!asTrimmed(listing.id)) return { ok: false, error: 'Missing listing id.' }

  if (
    !isRatingHandoffEligible(
      listing,
      fromUserId,
      toUserId,
      gates.acceptedOfferPairs,
    )
  ) {
    return {
      ok: false,
      error:
        'A rating requires a sold handoff or an accepted offer between you and the other party.',
    }
  }

  const inferred = inferRatingDirection(
    listing,
    fromUserId,
    toUserId,
    gates.acceptedOfferPairs,
  )
  if (!inferred) {
    return {
      ok: false,
      error:
        'A rating requires a sold handoff or an accepted offer between you and the other party.',
    }
  }

  const directionRaw = asTrimmed(input.direction)
  const direction = directionRaw
    ? isRatingDirection(directionRaw)
      ? directionRaw
      : null
    : inferred
  if (!direction) {
    return {
      ok: false,
      error: 'Direction must be buyer_rates_seller or seller_rates_buyer.',
    }
  }
  if (direction !== inferred) {
    return {
      ok: false,
      error: 'Direction does not match the buyer and seller on this listing.',
    }
  }

  const score = parseScore(input.score)
  if (score == null || score < 1 || score > 5) {
    return { ok: false, error: 'Score must be an integer from 1 to 5.' }
  }

  if (
    gates.existing &&
    gates.existing.fromUserId === fromUserId &&
    gates.existing.listingId === listing.id &&
    gates.existing.direction === direction
  ) {
    return {
      ok: false,
      error: 'You already rated this listing in this direction.',
    }
  }

  const note = asTrimmed(input.note).slice(0, 2000)
  const now = opts?.now ?? new Date()
  const newId = opts?.newId ?? (() => crypto.randomUUID())
  return {
    ok: true,
    rating: {
      id: newId(),
      fromUserId,
      toUserId,
      listingId: listing.id,
      direction,
      score,
      note,
      hidden: false,
      createdAt: now,
      updatedAt: now,
    },
  }
}

/**
 * Staff (app admin or admin.marketplace edit/manage) may hide a rating.
 */
export function decideMarketplaceHideRating(
  rating: MarketplaceRatingRecord | null,
  actor: { isStaff: boolean },
  opts?: { now?: Date },
): RatingHideDecision {
  if (!rating) return { ok: false, error: 'Rating not found.' }
  if (!actor.isStaff) {
    return { ok: false, error: 'Only Marketplace staff may hide a rating.' }
  }
  if (rating.hidden) {
    return { ok: true, rating }
  }
  const now = opts?.now ?? new Date()
  return {
    ok: true,
    rating: {
      ...rating,
      hidden: true,
      updatedAt: now,
    },
  }
}

/**
 * Public average for a user. Null until PUBLIC_RATING_THRESHOLD non-hidden
 * ratings exist. Hidden ratings are excluded.
 */
export function publicRatingAverage(
  ratings: ReadonlyArray<Pick<MarketplaceRatingRecord, 'score' | 'hidden'>>,
): number | null {
  const eligible = ratings.filter((r) => !r.hidden)
  if (eligible.length < PUBLIC_RATING_THRESHOLD) return null
  const sum = eligible.reduce((acc, r) => acc + r.score, 0)
  return sum / eligible.length
}
