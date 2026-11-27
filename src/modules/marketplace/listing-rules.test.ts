import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  decideListingEdit,
  decideListingHide,
  decideListingMarkPending,
  decideListingMarkSold,
  decideListingRemove,
  decideListingRenew,
  decideListingRestore,
  matchesPublicListingQuery,
  validateListingCreateFields,
  validateListingMediaIds,
} from './listing-rules'

const now = new Date('2026-11-27T12:00:00.000Z')
const future = new Date('2026-12-27T12:00:00.000Z')
const past = new Date('2026-10-27T12:00:00.000Z')

describe('marketplace listing create validation', () => {
  it('accepts a titled listing with a known condition and free or non-negative price', () => {
    const free = validateListingCreateFields(
      { title: 'AEG rifle', condition: 'used', priceMinor: null, mediaIds: [] },
      10,
    )
    assert.equal(free.ok, true)
    if (!free.ok) return
    assert.equal(free.values.title, 'AEG rifle')
    assert.equal(free.values.condition, 'used')
    assert.equal(free.values.priceMinor, null)

    const priced = validateListingCreateFields(
      { title: 'Plate carrier', condition: 'new', priceMinor: 15000 },
      10,
    )
    assert.equal(priced.ok, true)
    if (!priced.ok) return
    assert.equal(priced.values.priceMinor, 15000)
  })

  it('refuses an unknown condition', () => {
    const bad = validateListingCreateFields(
      { title: 'Helmet', condition: 'mint', priceMinor: 0 },
      10,
    )
    assert.equal(bad.ok, false)
    if (bad.ok) return
    assert.match(bad.error, /condition/i)
  })

  it('refuses an empty title', () => {
    const blank = validateListingCreateFields(
      { title: '   ', condition: 'used', priceMinor: null },
      10,
    )
    assert.equal(blank.ok, false)
    if (blank.ok) return
    assert.match(blank.error, /title/i)
  })

  it('refuses a negative price', () => {
    const neg = validateListingCreateFields(
      { title: 'Mag', condition: 'used', priceMinor: -1 },
      10,
    )
    assert.equal(neg.ok, false)
    if (neg.ok) return
    assert.match(neg.error, /≥ 0|>= 0|negative|integer/i)
  })
})

describe('marketplace listing photo cap', () => {
  it('accepts up to the photo cap', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `m${i + 1}`)
    const ok = validateListingMediaIds(ids, 10)
    assert.equal(ok.ok, true)
    if (!ok.ok) return
    assert.equal(ok.mediaIds.length, 10)

    const create = validateListingCreateFields(
      { title: 'Kit', condition: 'refurbished', priceMinor: 0, mediaIds: ids },
      10,
    )
    assert.equal(create.ok, true)
  })

  it('refuses an eleventh photo when the cap is 10', () => {
    const ids = Array.from({ length: 11 }, (_, i) => `m${i + 1}`)
    const media = validateListingMediaIds(ids, 10)
    assert.equal(media.ok, false)
    if (media.ok) return
    assert.match(media.error, /10|photo/i)

    const create = validateListingCreateFields(
      { title: 'Kit', condition: 'used', priceMinor: null, mediaIds: ids },
      10,
    )
    assert.equal(create.ok, false)
    if (create.ok) return
    assert.match(create.error, /10|photo/i)
  })
})

describe('marketplace public listing predicate', () => {
  it('includes active + enabled category + future expiresAt', () => {
    assert.equal(
      matchesPublicListingQuery({
        status: 'active',
        categoryEnabled: true,
        expiresAt: future,
        now,
      }),
      true,
    )
  })

  it('refuses non-active, disabled category, or expired', () => {
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
  })
})

describe('marketplace listing authz', () => {
  const listing = { sellerUserId: 'seller-1', status: 'active' as const }

  it('allows the seller to edit draft and active; refuses a non-owner', () => {
    const owner = decideListingEdit(
      { userId: 'seller-1', isStaff: false },
      listing,
    )
    assert.equal(owner.ok, true)

    const stranger = decideListingEdit(
      { userId: 'buyer-9', isStaff: false },
      listing,
    )
    assert.equal(stranger.ok, false)
    if (stranger.ok) return
    assert.match(stranger.error, /seller|staff/i)
  })

  it('allows staff to hide someone else’s active listing', () => {
    const staff = decideListingHide(
      { userId: 'admin-1', isStaff: true },
      listing,
    )
    assert.equal(staff.ok, true)
    if (!staff.ok) return
    assert.equal(staff.nextStatus, 'hidden')

    const stranger = decideListingHide(
      { userId: 'buyer-9', isStaff: false },
      listing,
    )
    assert.equal(stranger.ok, false)
  })

  it('lets the seller hide their own and move active → pending → sold', () => {
    const hide = decideListingHide(
      { userId: 'seller-1', isStaff: false },
      listing,
    )
    assert.equal(hide.ok, true)

    const pending = decideListingMarkPending(
      { userId: 'seller-1', isStaff: false },
      listing,
    )
    assert.equal(pending.ok, true)

    const sold = decideListingMarkSold(
      { userId: 'seller-1', isStaff: false },
      { sellerUserId: 'seller-1', status: 'pending' },
    )
    assert.equal(sold.ok, true)
  })

  it('lets staff remove and restore; refuses a member for remove', () => {
    const remove = decideListingRemove(
      { userId: 'admin-1', isStaff: true },
      listing,
    )
    assert.equal(remove.ok, true)

    const memberRemove = decideListingRemove(
      { userId: 'seller-1', isStaff: false },
      listing,
    )
    assert.equal(memberRemove.ok, false)

    const restore = decideListingRestore(
      { userId: 'admin-1', isStaff: true },
      { sellerUserId: 'seller-1', status: 'hidden' },
    )
    assert.equal(restore.ok, true)
    if (!restore.ok) return
    assert.equal(restore.nextStatus, 'active')
  })

  it('lets the seller renew with expiryDays', () => {
    const renew = decideListingRenew(
      { userId: 'seller-1', isStaff: false },
      { sellerUserId: 'seller-1', status: 'expired' },
      30,
      now,
    )
    assert.equal(renew.ok, true)
    if (!renew.ok) return
    assert.equal(renew.nextStatus, 'active')
    assert.equal(
      renew.expiresAt.getTime(),
      now.getTime() + 30 * 24 * 60 * 60 * 1000,
    )

    const stranger = decideListingRenew(
      { userId: 'buyer-9', isStaff: false },
      { sellerUserId: 'seller-1', status: 'expired' },
      30,
      now,
    )
    assert.equal(stranger.ok, false)
  })
})
