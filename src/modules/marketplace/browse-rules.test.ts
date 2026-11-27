import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  filterAndSortPublicListings,
  haversineKm,
  listingDistanceKm,
  type BrowseListingCandidate,
} from './browse-rules'
import { matchesPublicListingQuery } from './listing-rules'

const now = new Date('2026-11-27T12:00:00.000Z')
const future = new Date('2026-12-27T12:00:00.000Z')
const past = new Date('2026-10-27T12:00:00.000Z')

function listing(
  overrides: Partial<BrowseListingCandidate> & Pick<BrowseListingCandidate, 'id'>,
): BrowseListingCandidate {
  return {
    title: 'Item',
    description: '',
    priceMinor: 1000,
    condition: 'used',
    status: 'active',
    categoryId: 'cat-1',
    categoryEnabled: true,
    areaLabel: 'Budapest',
    latitude: 47.5,
    longitude: 19.05,
    expiresAt: future,
    createdAt: now,
    ...overrides,
  }
}

describe('marketplace haversine', () => {
  it('returns 0 for a point to itself', () => {
    const p = { latitude: 47.4979, longitude: 19.0402 }
    assert.equal(haversineKm(p, p), 0)
  })
})

describe('marketplace distance sort exclusion', () => {
  it('excludes a null coordinate from a distance sort', () => {
    const withCoords = listing({
      id: 'near',
      latitude: 47.5,
      longitude: 19.05,
      createdAt: new Date('2026-11-20T12:00:00.000Z'),
    })
    const noCoords = listing({
      id: 'no-coords',
      latitude: null,
      longitude: null,
      createdAt: new Date('2026-11-26T12:00:00.000Z'),
    })
    assert.equal(listingDistanceKm(noCoords, { latitude: 47.5, longitude: 19.05 }), null)

    const sorted = filterAndSortPublicListings([withCoords, noCoords], {
      sort: 'distance',
      viewer: { latitude: 47.5, longitude: 19.05 },
      now,
    })
    assert.deepEqual(
      sorted.map((row) => row.id),
      ['near'],
    )
  })

  it('still includes a null-coordinate listing on newest and price sorts', () => {
    const withCoords = listing({
      id: 'priced',
      priceMinor: 5000,
      latitude: 47.5,
      longitude: 19.05,
      createdAt: new Date('2026-11-20T12:00:00.000Z'),
    })
    const noCoords = listing({
      id: 'free-no-coords',
      priceMinor: null,
      latitude: null,
      longitude: null,
      createdAt: new Date('2026-11-26T12:00:00.000Z'),
    })
    const newest = filterAndSortPublicListings([withCoords, noCoords], {
      sort: 'newest',
      now,
    })
    assert.deepEqual(
      newest.map((row) => row.id),
      ['free-no-coords', 'priced'],
    )

    const byPrice = filterAndSortPublicListings([withCoords, noCoords], {
      sort: 'price',
      now,
    })
    assert.deepEqual(
      byPrice.map((row) => row.id),
      ['priced', 'free-no-coords'],
    )
  })
})

describe('marketplace public browse predicate', () => {
  it('matches the slice 3 rule: active, category enabled, expiresAt in the future only', () => {
    assert.equal(
      matchesPublicListingQuery({
        status: 'active',
        categoryEnabled: true,
        expiresAt: future,
        now,
      }),
      true,
    )
    assert.equal(
      matchesPublicListingQuery({
        status: 'pending',
        categoryEnabled: true,
        expiresAt: future,
        now,
      }),
      false,
    )
    assert.equal(
      matchesPublicListingQuery({
        status: 'active',
        categoryEnabled: false,
        expiresAt: future,
        now,
      }),
      false,
    )
    assert.equal(
      matchesPublicListingQuery({
        status: 'active',
        categoryEnabled: true,
        expiresAt: past,
        now,
      }),
      false,
    )

    const ok = listing({ id: 'public' })
    const pending = listing({ id: 'pending', status: 'pending' })
    const disabledCat = listing({ id: 'disabled-cat', categoryEnabled: false })
    const expired = listing({ id: 'expired', expiresAt: past })
    const sorted = filterAndSortPublicListings(
      [ok, pending, disabledCat, expired],
      { sort: 'newest', now },
    )
    assert.deepEqual(
      sorted.map((row) => row.id),
      ['public'],
    )
  })
})
