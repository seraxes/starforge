import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { matchesPublicListingQuery } from './listing-rules'
import {
  decideMarketplaceSave,
  decideMarketplaceUnsave,
  type MarketplaceSaveRecord,
} from './save-rules'

const now = new Date('2026-11-27T12:00:00.000Z')
const future = new Date('2026-12-27T12:00:00.000Z')

function makeSave(
  overrides: Partial<MarketplaceSaveRecord> = {},
): MarketplaceSaveRecord {
  return {
    id: 'save-1',
    userId: 'buyer-1',
    listingId: 'listing-1',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('marketplace save — public predicate gate', () => {
  it('refuses saving a listing the public predicate rejects', () => {
    const notPublic = matchesPublicListingQuery({
      status: 'draft',
      categoryEnabled: true,
      expiresAt: future,
      now,
    })
    assert.equal(notPublic, false)

    const refused = decideMarketplaceSave(
      null,
      { userId: 'buyer-1', listingId: 'listing-1' },
      { isPublic: notPublic },
      { now, newId: () => 'save-new' },
    )
    assert.equal(refused.ok, false)
    if (refused.ok) return
    assert.match(refused.error, /public/i)
  })

  it('accepts saving a listing that matches the public predicate', () => {
    const isPublic = matchesPublicListingQuery({
      status: 'active',
      categoryEnabled: true,
      expiresAt: future,
      now,
    })
    assert.equal(isPublic, true)

    const saved = decideMarketplaceSave(
      null,
      { userId: 'buyer-1', listingId: 'listing-1' },
      { isPublic },
      { now, newId: () => 'save-new' },
    )
    assert.equal(saved.ok, true)
    if (!saved.ok) return
    assert.equal(saved.write, 'insert')
    assert.equal(saved.save.id, 'save-new')
    assert.equal(saved.save.userId, 'buyer-1')
    assert.equal(saved.save.listingId, 'listing-1')
  })
})

describe('marketplace save — unique pair', () => {
  it('does not insert a second row for the same user and listing', () => {
    const current = makeSave()
    const again = decideMarketplaceSave(
      current,
      { userId: 'buyer-1', listingId: 'listing-1' },
      { isPublic: true },
      { now, newId: () => 'save-should-not-use' },
    )
    assert.equal(again.ok, true)
    if (!again.ok) return
    assert.equal(again.write, 'noop')
    assert.equal(again.save.id, current.id)
    assert.notEqual(again.write, 'insert')
  })
})

describe('marketplace unsave', () => {
  it('removes an existing save', () => {
    const current = makeSave()
    const result = decideMarketplaceUnsave(current, 'buyer-1', 'listing-1')
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.removed.id, current.id)
  })

  it('refuses when the pair is not saved', () => {
    const result = decideMarketplaceUnsave(null, 'buyer-1', 'listing-1')
    assert.equal(result.ok, false)
    if (result.ok) return
    assert.match(result.error, /not saved/i)
  })
})
