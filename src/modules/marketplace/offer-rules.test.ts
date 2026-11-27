import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  decideMarketplaceAskAvailable,
  decideMarketplaceOpenOffer,
  decideMarketplacePostMessage,
  decideMarketplaceRespondOffer,
  type MarketplaceInquiryRecord,
  type MarketplaceOfferRecord,
} from './offer-rules'

const now = new Date('2026-11-27T12:00:00.000Z')

const inquiry: MarketplaceInquiryRecord = {
  id: 'inq-1',
  listingId: 'listing-1',
  buyerUserId: 'buyer-1',
  createdAt: now,
  updatedAt: now,
}

const participants = {
  buyerUserId: 'buyer-1',
  sellerUserId: 'seller-1',
}

function makeOpenOffer(
  overrides: Partial<MarketplaceOfferRecord> = {},
): MarketplaceOfferRecord {
  return {
    id: 'offer-1',
    inquiryId: 'inq-1',
    amountMinor: 5000,
    status: 'open',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('marketplace offer — offersEnabled gate', () => {
  it('refuses offers when offersEnabled is false', () => {
    const refused = decideMarketplaceOpenOffer(
      inquiry,
      participants,
      { buyerUserId: 'buyer-1', amountMinor: 1000 },
      { offersEnabled: false, openOffer: null },
      { now, newId: () => 'offer-new' },
    )
    assert.equal(refused.ok, false)
    if (refused.ok) return
    assert.match(refused.error, /disabled/i)
  })

  it('accepts an offer when offersEnabled is true', () => {
    const opened = decideMarketplaceOpenOffer(
      inquiry,
      participants,
      { buyerUserId: 'buyer-1', amountMinor: 1000 },
      { offersEnabled: true, openOffer: null },
      { now, newId: () => 'offer-new' },
    )
    assert.equal(opened.ok, true)
    if (!opened.ok) return
    assert.equal(opened.offer.amountMinor, 1000)
    assert.equal(opened.offer.status, 'open')
    assert.equal(opened.cartLine, undefined)
  })
})

describe('marketplace offer — one open offer', () => {
  it('refuses a second open offer on the same inquiry', () => {
    const refused = decideMarketplaceOpenOffer(
      inquiry,
      participants,
      { buyerUserId: 'buyer-1', amountMinor: 2000 },
      { offersEnabled: true, openOffer: makeOpenOffer() },
      { now, newId: () => 'offer-should-not-use' },
    )
    assert.equal(refused.ok, false)
    if (refused.ok) return
    assert.match(refused.error, /open offer/i)
  })
})

describe('marketplace offer — accept has no Payments cart line', () => {
  it('accept has no cart line and does not require a Payments call', () => {
    const accepted = decideMarketplaceRespondOffer(
      inquiry,
      participants,
      makeOpenOffer(),
      { sellerUserId: 'seller-1', response: 'accept' },
      { now },
    )
    assert.equal(accepted.ok, true)
    if (!accepted.ok) return
    assert.equal(accepted.offer.status, 'accepted')
    assert.equal(accepted.cartLine, undefined)
    assert.ok(!('cartLine' in accepted && accepted.cartLine != null))
    assert.deepEqual(accepted.listingSold, {
      soldToUserId: 'buyer-1',
      status: 'sold',
    })
    // Rule result shape must not imply a Payments write.
    assert.equal(
      Object.prototype.hasOwnProperty.call(accepted, 'cartLine')
        ? accepted.cartLine
        : undefined,
      undefined,
    )
  })

  it('decline leaves the listing untouched', () => {
    const declined = decideMarketplaceRespondOffer(
      inquiry,
      participants,
      makeOpenOffer(),
      { sellerUserId: 'seller-1', response: 'decline' },
      { now },
    )
    assert.equal(declined.ok, true)
    if (!declined.ok) return
    assert.equal(declined.offer.status, 'declined')
    assert.equal(declined.listingSold, undefined)
    assert.equal(declined.cartLine, undefined)
  })
})

describe('marketplace inquiry — stranger post refused', () => {
  it('refuses a stranger message', () => {
    const refused = decideMarketplacePostMessage(
      inquiry,
      participants,
      { authorUserId: 'stranger-9', body: 'Hello', kind: 'text' },
      { now, newId: () => 'msg-x' },
    )
    assert.equal(refused.ok, false)
    if (refused.ok) return
    assert.match(refused.error, /buyer or seller/i)
  })

  it('allows the buyer to ask if available', () => {
    const asked = decideMarketplaceAskAvailable(
      inquiry,
      participants,
      'buyer-1',
      { now, newId: () => 'msg-avail' },
    )
    assert.equal(asked.ok, true)
    if (!asked.ok) return
    assert.equal(asked.message.kind, 'availability')
    assert.match(asked.message.body, /available/i)
  })

  it('refuses a stranger open offer', () => {
    const refused = decideMarketplaceOpenOffer(
      inquiry,
      participants,
      { buyerUserId: 'stranger-9', amountMinor: 500 },
      { offersEnabled: true, openOffer: null },
      { now, newId: () => 'offer-x' },
    )
    assert.equal(refused.ok, false)
    if (refused.ok) return
    assert.match(refused.error, /buyer/i)
  })
})
