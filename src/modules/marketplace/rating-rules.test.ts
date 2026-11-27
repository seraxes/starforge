import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  decideMarketplaceHideRating,
  decideMarketplaceSubmitRating,
  publicRatingAverage,
  type MarketplaceRatingRecord,
  type RatingListingHandoff,
} from './rating-rules'

const now = new Date('2026-11-27T12:00:00.000Z')

const listing: RatingListingHandoff = {
  id: 'listing-1',
  sellerUserId: 'seller-1',
  soldToUserId: 'buyer-1',
}

const listingNoHandoff: RatingListingHandoff = {
  id: 'listing-2',
  sellerUserId: 'seller-1',
  soldToUserId: null,
}

function makeRating(
  overrides: Partial<MarketplaceRatingRecord> = {},
): MarketplaceRatingRecord {
  return {
    id: 'rating-1',
    fromUserId: 'buyer-1',
    toUserId: 'seller-1',
    listingId: 'listing-1',
    direction: 'buyer_rates_seller',
    score: 5,
    note: '',
    hidden: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('marketplace rating — handoff required', () => {
  it('refuses a rating with no handoff', () => {
    const refused = decideMarketplaceSubmitRating(
      listingNoHandoff,
      {
        fromUserId: 'buyer-1',
        toUserId: 'seller-1',
        score: 5,
      },
      { acceptedOfferPairs: [], existing: null },
      { now, newId: () => 'rating-x' },
    )
    assert.equal(refused.ok, false)
    if (refused.ok) return
    assert.match(refused.error, /handoff|accepted offer/i)
  })

  it('accepts a rating after soldToUserId handoff', () => {
    const ok = decideMarketplaceSubmitRating(
      listing,
      {
        fromUserId: 'buyer-1',
        toUserId: 'seller-1',
        score: 4,
        note: 'Smooth meetup',
      },
      { acceptedOfferPairs: [], existing: null },
      { now, newId: () => 'rating-ok' },
    )
    assert.equal(ok.ok, true)
    if (!ok.ok) return
    assert.equal(ok.rating.score, 4)
    assert.equal(ok.rating.direction, 'buyer_rates_seller')
    assert.equal(ok.rating.fromUserId, 'buyer-1')
    assert.equal(ok.rating.toUserId, 'seller-1')
  })

  it('accepts a rating when an accepted offer joins the same pair', () => {
    const ok = decideMarketplaceSubmitRating(
      listingNoHandoff,
      {
        fromUserId: 'seller-1',
        toUserId: 'buyer-9',
        score: 5,
      },
      {
        acceptedOfferPairs: [
          { buyerUserId: 'buyer-9', sellerUserId: 'seller-1' },
        ],
        existing: null,
      },
      { now, newId: () => 'rating-offer' },
    )
    assert.equal(ok.ok, true)
    if (!ok.ok) return
    assert.equal(ok.rating.direction, 'seller_rates_buyer')
  })
})

describe('marketplace rating — score bounds', () => {
  it('refuses score 0', () => {
    const refused = decideMarketplaceSubmitRating(
      listing,
      {
        fromUserId: 'buyer-1',
        toUserId: 'seller-1',
        score: 0,
      },
      { acceptedOfferPairs: [], existing: null },
      { now, newId: () => 'rating-0' },
    )
    assert.equal(refused.ok, false)
    if (refused.ok) return
    assert.match(refused.error, /1 to 5/i)
  })

  it('refuses score 6', () => {
    const refused = decideMarketplaceSubmitRating(
      listing,
      {
        fromUserId: 'buyer-1',
        toUserId: 'seller-1',
        score: 6,
      },
      { acceptedOfferPairs: [], existing: null },
      { now, newId: () => 'rating-6' },
    )
    assert.equal(refused.ok, false)
    if (refused.ok) return
    assert.match(refused.error, /1 to 5/i)
  })

  it('refuses a second rating in the same direction for the same listing', () => {
    const refused = decideMarketplaceSubmitRating(
      listing,
      {
        fromUserId: 'buyer-1',
        toUserId: 'seller-1',
        score: 3,
      },
      { acceptedOfferPairs: [], existing: makeRating() },
      { now, newId: () => 'rating-dup' },
    )
    assert.equal(refused.ok, false)
    if (refused.ok) return
    assert.match(refused.error, /already rated/i)
  })
})

describe('marketplace rating — public average threshold', () => {
  it('stays null at 4 non-hidden ratings and appears at 5', () => {
    const four = [
      { score: 5, hidden: false },
      { score: 4, hidden: false },
      { score: 3, hidden: false },
      { score: 5, hidden: false },
    ]
    assert.equal(publicRatingAverage(four), null)

    const five = [...four, { score: 4, hidden: false }]
    const avg = publicRatingAverage(five)
    assert.notEqual(avg, null)
    assert.equal(avg, (5 + 4 + 3 + 5 + 4) / 5)
  })

  it('excludes hidden ratings from the public average', () => {
    const mixed = [
      { score: 5, hidden: false },
      { score: 5, hidden: false },
      { score: 5, hidden: false },
      { score: 5, hidden: false },
      { score: 1, hidden: true },
    ]
    assert.equal(publicRatingAverage(mixed), null)
  })
})

describe('marketplace rating — staff hide', () => {
  it('allows staff to hide a rating', () => {
    const decided = decideMarketplaceHideRating(makeRating(), { isStaff: true }, { now })
    assert.equal(decided.ok, true)
    if (!decided.ok) return
    assert.equal(decided.rating.hidden, true)
  })

  it('refuses hide when the actor is not staff', () => {
    const refused = decideMarketplaceHideRating(makeRating(), { isStaff: false }, { now })
    assert.equal(refused.ok, false)
    if (refused.ok) return
    assert.match(refused.error, /staff/i)
  })
})
