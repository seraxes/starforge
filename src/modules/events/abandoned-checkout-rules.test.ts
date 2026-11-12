import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { abandonedHoldAction } from './abandoned-checkout-rules'

const now = new Date('2026-11-12T12:00:00.000Z')
const recent = new Date('2026-11-12T11:30:00.000Z')
const stale = new Date('2026-11-12T10:00:00.000Z')

describe('abandonedHoldAction', () => {
  it('keeps pay-at-entrance and other offline holds', () => {
    assert.equal(
      abandonedHoldAction({
        paymentOrderId: 'ord_door',
        updatedAt: stale,
        order: { status: 'awaiting_offline' },
        ttlMinutes: 60,
        now,
      }),
      'keep',
    )
  })

  it('keeps an online checkout Payments has not expired yet', () => {
    assert.equal(
      abandonedHoldAction({
        paymentOrderId: 'ord_open',
        updatedAt: stale,
        order: { status: 'redirected_provider' },
        ttlMinutes: 60,
        now,
      }),
      'keep',
    )
  })

  it('releases a hold whose order Payments already closed unpaid', () => {
    for (const status of ['expired', 'failed', 'refunded']) {
      assert.equal(
        abandonedHoldAction({
          paymentOrderId: 'ord_closed',
          updatedAt: recent,
          order: { status },
          ttlMinutes: 60,
          now,
        }),
        'release',
      )
    }
  })

  it('keeps a paid order so the sweep does not register or cancel it', () => {
    for (const status of ['paid', 'fulfilled']) {
      assert.equal(
        abandonedHoldAction({
          paymentOrderId: 'ord_paid',
          updatedAt: stale,
          order: { status },
          ttlMinutes: 60,
          now,
        }),
        'keep',
      )
    }
  })

  it('releases a hold that never received an order id after the checkout TTL', () => {
    assert.equal(
      abandonedHoldAction({
        paymentOrderId: '',
        updatedAt: stale,
        order: null,
        ttlMinutes: 60,
        now,
      }),
      'release',
    )
    assert.equal(
      abandonedHoldAction({
        paymentOrderId: null,
        updatedAt: recent,
        order: null,
        ttlMinutes: 60,
        now,
      }),
      'keep',
    )
  })

  it('releases a missing order only after the TTL', () => {
    assert.equal(
      abandonedHoldAction({
        paymentOrderId: 'ord_missing',
        updatedAt: stale,
        order: null,
        ttlMinutes: 60,
        now,
      }),
      'release',
    )
    assert.equal(
      abandonedHoldAction({
        paymentOrderId: 'ord_missing',
        updatedAt: recent,
        order: null,
        ttlMinutes: 60,
        now,
      }),
      'keep',
    )
  })
})
