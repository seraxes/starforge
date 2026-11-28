import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

/**
 * In-memory stand-in for sf_pay_orders_idempotency_uidx + transitionToPaid
 * atomic claim. Production startCheckout / applyProviderPaymentResult rely on
 * that unique index and the conditional status update; this test locks the
 * contract without hitting Postgres.
 */

type OrderRow = {
  id: string
  idempotencyKey: string
  status: 'checkout_pending' | 'redirected_provider' | 'paid' | 'fulfilled' | 'failed'
  totalGrossMinor: number
}

type OrderBag = {
  byKey: Map<string, OrderRow>
  byId: Map<string, OrderRow>
}

const PAYABLE = new Set(['checkout_pending', 'redirected_provider', 'awaiting_offline', 'expired'])

function createOrderBag(): OrderBag {
  return { byKey: new Map(), byId: new Map() }
}

/** Insert with unique idempotencyKey — second insert returns the existing row. */
function insertOrderIdempotent(
  bag: OrderBag,
  input: { id: string; idempotencyKey: string; totalGrossMinor: number },
): { order: OrderRow; created: boolean } {
  const existing = bag.byKey.get(input.idempotencyKey)
  if (existing) return { order: existing, created: false }
  const order: OrderRow = {
    id: input.id,
    idempotencyKey: input.idempotencyKey,
    status: 'checkout_pending',
    totalGrossMinor: input.totalGrossMinor,
  }
  bag.byKey.set(input.idempotencyKey, order)
  bag.byId.set(order.id, order)
  return { order, created: true }
}

/**
 * Double-delivered payment webhook: only one concurrent transition wins.
 * Same shape as transitionToPaid's conditional UPDATE … RETURNING claim.
 */
function claimOrderPaid(
  bag: OrderBag,
  orderId: string,
): { ok: true; claimed: boolean } | { ok: false; error: string } {
  const order = bag.byId.get(orderId)
  if (!order) return { ok: false, error: 'Order not found' }
  if (order.status === 'paid' || order.status === 'fulfilled') {
    return { ok: true, claimed: false }
  }
  if (!PAYABLE.has(order.status)) {
    return { ok: false, error: `Cannot mark paid from status ${order.status}` }
  }
  order.status = 'paid'
  return { ok: true, claimed: true }
}

describe('payment order idempotency', () => {
  it('same idempotencyKey leaves one order (unique index contract)', () => {
    const bag = createOrderBag()
    const first = insertOrderIdempotent(bag, {
      id: 'ord_1',
      idempotencyKey: 'checkout:cart_1:buyer@example.com',
      totalGrossMinor: 5000,
    })
    const second = insertOrderIdempotent(bag, {
      id: 'ord_2',
      idempotencyKey: 'checkout:cart_1:buyer@example.com',
      totalGrossMinor: 5000,
    })

    assert.equal(first.created, true)
    assert.equal(second.created, false)
    assert.equal(second.order.id, first.order.id)
    assert.equal(bag.byId.size, 1)
    assert.equal(bag.byKey.size, 1)
  })

  it('double-delivered paid webhook claims once and leaves one paid order', () => {
    const bag = createOrderBag()
    const { order } = insertOrderIdempotent(bag, {
      id: 'ord_1',
      idempotencyKey: 'webhook:provider-ref-1',
      totalGrossMinor: 5000,
    })

    const first = claimOrderPaid(bag, order.id)
    const second = claimOrderPaid(bag, order.id)

    assert.deepEqual(first, { ok: true, claimed: true })
    assert.deepEqual(second, { ok: true, claimed: false })
    assert.equal(bag.byId.get(order.id)?.status, 'paid')
    assert.equal(bag.byId.size, 1)
  })
})
