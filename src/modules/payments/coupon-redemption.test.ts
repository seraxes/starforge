import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  claimCouponUsageBump,
  recordCouponRedemptionInBag,
  type CouponRedemptionBag,
} from './coupon-rules'

/** Serialize async redemptions so bump+insert stay atomic. */
function createRedemptionQueue() {
  let chain: Promise<unknown> = Promise.resolve()
  return function enqueue<T>(fn: () => T | Promise<T>): Promise<T> {
    const next = chain.then(() => fn())
    chain = next.then(
      () => undefined,
      () => undefined,
    )
    return next
  }
}

describe('claimCouponUsageBump', () => {
  it('allows the first use of a single-use coupon', () => {
    assert.equal(claimCouponUsageBump({ usageLimit: 1, usedCount: 0 }), 1)
  })

  it('refuses a second bump when usageLimit is 1', () => {
    assert.equal(claimCouponUsageBump({ usageLimit: 1, usedCount: 1 }), null)
  })
})

describe('single-use coupon redemption race', () => {
  it('two different order ids leave one redemption and usedCount === 1 (success + failure)', async () => {
    const bag: CouponRedemptionBag = {
      coupons: new Map([['cpn_1', { usageLimit: 1, usedCount: 0 }]]),
      redemptions: [],
    }
    const enqueue = createRedemptionQueue()

    const [first, second] = await Promise.all([
      enqueue(() =>
        recordCouponRedemptionInBag(bag, {
          id: 'cred_a',
          couponId: 'cpn_1',
          orderId: 'ord_a',
          discountMinor: 500,
        }),
      ),
      enqueue(() =>
        recordCouponRedemptionInBag(bag, {
          id: 'cred_b',
          couponId: 'cpn_1',
          orderId: 'ord_b',
          discountMinor: 500,
        }),
      ),
    ])

    const winner = first.ok ? first : second
    const loser = first.ok ? second : first
    assert.equal(winner.ok, true)
    if (!winner.ok) return
    assert.equal(winner.usedCount, 1)
    assert.equal(loser.ok, false)
    if (loser.ok) return
    assert.equal(loser.error, 'couponUsageLimit')

    assert.equal(bag.redemptions.length, 1)
    assert.equal(bag.coupons.get('cpn_1')?.usedCount, 1)
    assert.equal(bag.redemptions[0]?.orderId === 'ord_a' || bag.redemptions[0]?.orderId === 'ord_b', true)
  })

  it('does not keep a redemption when the bump would change zero rows', () => {
    const bag: CouponRedemptionBag = {
      coupons: new Map([['cpn_1', { usageLimit: 1, usedCount: 1 }]]),
      redemptions: [],
    }
    const result = recordCouponRedemptionInBag(bag, {
      id: 'cred_x',
      couponId: 'cpn_1',
      orderId: 'ord_x',
      discountMinor: 100,
    })
    assert.equal(result.ok, false)
    assert.equal(bag.redemptions.length, 0)
    assert.equal(bag.coupons.get('cpn_1')?.usedCount, 1)
  })
})
