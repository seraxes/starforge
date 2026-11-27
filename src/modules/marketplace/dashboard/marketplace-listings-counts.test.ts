import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  countMarketplaceListingsStats,
  marketplaceListingsByKeyFromResult,
  type MarketplaceListingsCountRow,
} from './marketplace-listings-counts'

const NOW = new Date('2026-11-27T12:00:00.000Z')
const FUTURE = new Date('2026-12-27T12:00:00.000Z')
const PAST = new Date('2026-10-01T12:00:00.000Z')
const WITHIN_7D = new Date('2026-11-25T12:00:00.000Z')
const OLDER_THAN_7D = new Date('2026-11-01T12:00:00.000Z')

function row(
  partial: Partial<MarketplaceListingsCountRow> & Pick<MarketplaceListingsCountRow, 'status'>,
): MarketplaceListingsCountRow {
  return {
    categoryEnabled: true,
    expiresAt: FUTURE,
    createdAt: OLDER_THAN_7D,
    ...partial,
  }
}

describe('countMarketplaceListingsStats', () => {
  it('maps a fixture set of statuses to active, new7d, and pending counts', () => {
    const rows: MarketplaceListingsCountRow[] = [
      // public active
      row({ status: 'active', createdAt: WITHIN_7D }),
      // active but category off — not public
      row({ status: 'active', categoryEnabled: false, createdAt: WITHIN_7D }),
      // active but expired — not public
      row({ status: 'active', expiresAt: PAST, createdAt: OLDER_THAN_7D }),
      // pending (counts pending; also new7d)
      row({ status: 'pending', createdAt: WITHIN_7D }),
      // draft created recently — new7d only
      row({ status: 'draft', createdAt: WITHIN_7D, expiresAt: null }),
      // removed recently — excluded from new7d
      row({ status: 'removed', createdAt: WITHIN_7D }),
      // sold older — none of the three
      row({ status: 'sold', createdAt: OLDER_THAN_7D }),
      // second public active (older than 7d)
      row({ status: 'active', createdAt: OLDER_THAN_7D }),
    ]

    // new7d: public active, category-off active, pending, draft (removed excluded)
    assert.deepEqual(countMarketplaceListingsStats(rows, NOW), {
      active: 2,
      new7d: 4,
      pending: 1,
    })
  })
})

describe('marketplaceListingsByKeyFromResult', () => {
  it('keeps an unavailable result as nulls and does not become zeros', () => {
    const byKey = marketplaceListingsByKeyFromResult({
      ok: false,
      error: 'Marketplace module is disabled',
      status: 'unavailable',
    })
    assert.deepEqual(byKey, { active: null, new7d: null, pending: null })
    assert.notEqual(byKey.active, 0)
    assert.notEqual(byKey.new7d, 0)
    assert.notEqual(byKey.pending, 0)
  })

  it('passes through ok counts including real zeros', () => {
    const byKey = marketplaceListingsByKeyFromResult({
      ok: true,
      data: { byKey: { active: 0, new7d: 2, pending: 0 } },
    })
    assert.deepEqual(byKey, { active: 0, new7d: 2, pending: 0 })
  })
})
