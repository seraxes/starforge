import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildMarketplaceListingShareInput,
  marketplaceListingShareSourceKey,
  shareMarketplaceListingThroughSocial,
  type MarketplaceShareListing,
  type MarketplaceSharePublishInput,
} from './share-rules'

const listing: MarketplaceShareListing = {
  id: 'listing-1',
  sellerUserId: 'seller-1',
  title: 'Airsoft vest',
  mediaIds: ['media-a', 'media-b'],
}

describe('marketplace share — Social disabled', () => {
  it('does not call the write when Social is off', async () => {
    let writeCalls = 0
    const result = await shareMarketplaceListingThroughSocial(
      { socialEnabled: false },
      { userId: 'seller-1', isStaff: false },
      listing,
      async () => {
        writeCalls += 1
        return { ok: true }
      },
    )

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.reason, 'disabled')
    assert.equal(writeCalls, 0)
  })
})

describe('marketplace share — source key', () => {
  it('a second share uses the same source key', async () => {
    const captured: MarketplaceSharePublishInput[] = []
    const write = async (input: MarketplaceSharePublishInput) => {
      captured.push(input)
      return { ok: true } as const
    }
    const actor = { userId: 'seller-1', isStaff: false }

    const first = await shareMarketplaceListingThroughSocial(
      { socialEnabled: true },
      actor,
      listing,
      write,
    )
    const second = await shareMarketplaceListingThroughSocial(
      { socialEnabled: true },
      actor,
      { ...listing, title: 'Airsoft vest (updated)' },
      write,
    )

    assert.equal(first.ok, true)
    assert.equal(second.ok, true)
    if (!first.ok || !second.ok) return

    assert.deepEqual(first.sourceKey, second.sourceKey)
    assert.equal(captured.length, 2)
    assert.equal(captured[0]?.sourceModule, 'product:marketplace')
    assert.equal(captured[0]?.sourceId, 'listing-1')
    assert.equal(captured[0]?.activityKind, 'listing.shared')
    assert.equal(captured[1]?.sourceModule, captured[0]?.sourceModule)
    assert.equal(captured[1]?.sourceId, captured[0]?.sourceId)
    assert.equal(captured[1]?.activityKind, captured[0]?.activityKind)

    const keyA = marketplaceListingShareSourceKey('listing-1')
    const keyB = marketplaceListingShareSourceKey('listing-1')
    assert.deepEqual(keyA, keyB)
    assert.deepEqual(keyA, first.sourceKey)
  })

  it('builds a publish payload with title, href, and first media id', () => {
    const input = buildMarketplaceListingShareInput(listing, 'seller-1')
    assert.ok(input)
    assert.equal(input?.sourceModule, 'product:marketplace')
    assert.equal(input?.sourceId, 'listing-1')
    assert.equal(input?.activityKind, 'listing.shared')
    assert.equal(input?.snapshot.title, 'Airsoft vest')
    assert.equal(input?.snapshot.href, '/marketplace/listing-1')
    assert.equal(input?.snapshot.mediaId, 'media-a')
  })
})
