import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  applyCouponToLines,
  computeCouponDiscountMinor,
  formatCouponDiscountInput,
  lineMatchesCouponScope,
  normalizeCouponCode,
  parseCouponDiscountInput,
  type CouponLineInput,
} from './coupon-rules'

function line(partial: Partial<CouponLineInput> & { id: string }): CouponLineInput {
  return {
    sourceModule: 'product:events',
    sourceType: 'ticket_tier',
    sourceId: 'tier_1',
    title: 'Ticket',
    qty: 1,
    currency: 'HUF',
    unitNetMinor: 3937,
    unitGrossMinor: 5000,
    vatRateBps: 2700,
    vatCategory: 'standard',
    vatAmountMinor: 1063,
    lineNetMinor: 3937,
    lineGrossMinor: 5000,
    metadata: { eventId: 'evt_1' },
    ...partial,
  }
}

describe('parseCouponDiscountInput', () => {
  it('treats a bare number as amount and a trailing % as percent', () => {
    assert.deepEqual(parseCouponDiscountInput('500'), { mode: 'amount', value: 500 })
    assert.deepEqual(parseCouponDiscountInput('10%'), { mode: 'percent', value: 10 })
    assert.deepEqual(parseCouponDiscountInput('10 %'), { mode: 'percent', value: 10 })
    assert.equal(formatCouponDiscountInput({ mode: 'percent', value: 10 }), '10%')
  })

  it('rejects non-positive discounts', () => {
    assert.deepEqual(parseCouponDiscountInput('0'), { mode: 'amount', value: 0 })
    assert.deepEqual(parseCouponDiscountInput('-5%'), { mode: 'amount', value: 0 })
    assert.deepEqual(parseCouponDiscountInput(''), { mode: 'amount', value: 0 })
  })

  it('normalizes codes uppercase without spaces', () => {
    assert.equal(normalizeCouponCode(' summer 10 '), 'SUMMER10')
  })
})

describe('lineMatchesCouponScope', () => {
  it('matches site-wide coupons to any line', () => {
    assert.equal(
      lineMatchesCouponScope(line({ id: 'a' }), { sourceModule: null, sourceId: null }),
      true,
    )
  })

  it('scopes Events coupons by metadata.eventId', () => {
    const l = line({ id: 'a', metadata: { eventId: 'evt_9' } })
    assert.equal(
      lineMatchesCouponScope(l, { sourceModule: 'product:events', sourceId: 'evt_9' }),
      true,
    )
    assert.equal(
      lineMatchesCouponScope(l, { sourceModule: 'product:events', sourceId: 'evt_other' }),
      false,
    )
  })

  it('scopes other modules by line sourceId', () => {
    const l = line({
      id: 'a',
      sourceModule: 'product:shop',
      sourceId: 'sku_1',
      metadata: {},
    })
    assert.equal(
      lineMatchesCouponScope(l, { sourceModule: 'product:shop', sourceId: 'sku_1' }),
      true,
    )
    assert.equal(
      lineMatchesCouponScope(l, { sourceModule: 'product:shop', sourceId: 'sku_2' }),
      false,
    )
  })
})

describe('computeCouponDiscountMinor', () => {
  it('applies amount and percent and caps at eligible gross', () => {
    assert.equal(
      computeCouponDiscountMinor(
        { discountMode: 'amount', discountValue: 500, currency: 'HUF' },
        5000,
        'HUF',
      ),
      500,
    )
    assert.equal(
      computeCouponDiscountMinor(
        { discountMode: 'percent', discountValue: 10, currency: 'HUF' },
        5000,
        'HUF',
      ),
      500,
    )
    assert.equal(
      computeCouponDiscountMinor(
        { discountMode: 'amount', discountValue: 9000, currency: 'HUF' },
        5000,
        'HUF',
      ),
      5000,
    )
  })
})

describe('applyCouponToLines', () => {
  it('reduces eligible line gross and leaves other lines alone', () => {
    const lines = [
      line({ id: 'a', lineGrossMinor: 5000, unitGrossMinor: 5000 }),
      line({
        id: 'b',
        sourceModule: 'product:shop',
        sourceId: 'sku_1',
        lineGrossMinor: 2000,
        unitGrossMinor: 2000,
        metadata: {},
      }),
    ]
    const applied = applyCouponToLines({
      lines,
      coupon: {
        id: 'cpn_1',
        code: 'SAVE10',
        discountMode: 'percent',
        discountValue: 10,
        currency: 'HUF',
        sourceModule: 'product:events',
        sourceId: 'evt_1',
      },
      amountIsGross: true,
    })
    assert.ok(!('error' in applied))
    assert.equal(applied.discountMinor, 500)
    assert.equal(applied.lines[0]!.lineGrossMinor, 4500)
    assert.equal(applied.lines[1]!.lineGrossMinor, 2000)
  })

  it('fails when no lines match scope', () => {
    const applied = applyCouponToLines({
      lines: [line({ id: 'a', metadata: { eventId: 'evt_other' } })],
      coupon: {
        id: 'cpn_1',
        code: 'EVT',
        discountMode: 'amount',
        discountValue: 100,
        currency: 'HUF',
        sourceModule: 'product:events',
        sourceId: 'evt_1',
      },
      amountIsGross: true,
    })
    assert.ok('error' in applied)
  })
})
