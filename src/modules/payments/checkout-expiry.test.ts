import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { shouldExpireAbandonedOnlineCheckout } from './checkout-expiry'

const now = new Date('2026-11-12T12:00:00.000Z')
const past = new Date('2026-11-12T11:00:00.000Z')
const future = new Date('2026-11-12T13:00:00.000Z')

describe('shouldExpireAbandonedOnlineCheckout', () => {
  it('expires a Barion checkout that is still open past the TTL', () => {
    assert.equal(
      shouldExpireAbandonedOnlineCheckout(
        { status: 'redirected_provider', method: 'barion', expiresAt: past },
        now,
      ),
      true,
    )
    assert.equal(
      shouldExpireAbandonedOnlineCheckout(
        { status: 'checkout_pending', method: 'stripe', expiresAt: past },
        now,
      ),
      true,
    )
    assert.equal(
      shouldExpireAbandonedOnlineCheckout(
        { status: 'checkout_pending', method: 'paypal', expiresAt: now },
        now,
      ),
      true,
    )
  })

  it('keeps an online checkout that is still inside the TTL', () => {
    assert.equal(
      shouldExpireAbandonedOnlineCheckout(
        { status: 'redirected_provider', method: 'barion', expiresAt: future },
        now,
      ),
      false,
    )
  })

  it('keeps pay-at-entrance, cash, and bank transfer', () => {
    for (const method of ['pay_at_entrance', 'cash', 'bank_transfer'] as const) {
      assert.equal(
        shouldExpireAbandonedOnlineCheckout(
          { status: 'awaiting_offline', method, expiresAt: past },
          now,
        ),
        false,
      )
      assert.equal(
        shouldExpireAbandonedOnlineCheckout(
          { status: 'checkout_pending', method, expiresAt: past },
          now,
        ),
        false,
      )
    }
  })

  it('keeps settled or already closed orders', () => {
    for (const status of ['paid', 'fulfilled', 'expired', 'failed', 'refunded']) {
      assert.equal(
        shouldExpireAbandonedOnlineCheckout(
          { status, method: 'barion', expiresAt: past },
          now,
        ),
        false,
      )
    }
  })

  it('keeps an online checkout with no expiry', () => {
    assert.equal(
      shouldExpireAbandonedOnlineCheckout(
        { status: 'checkout_pending', method: 'barion', expiresAt: null },
        now,
      ),
      false,
    )
  })
})
