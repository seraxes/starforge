import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'

import {
  clearPaymentConsumerHooks,
  getPaymentConsumerHook,
  registerPaymentConsumerHook,
  runPaymentConsumerHook,
  type PaymentConsumerHookContext,
} from './consumer-hooks'

const ctx: PaymentConsumerHookContext = {
  orderId: 'order-1',
  status: 'paid',
  lines: [],
  metadata: {},
}

afterEach(() => {
  clearPaymentConsumerHooks()
})

describe('runPaymentConsumerHook', () => {
  it('runs two registrations on the same key instead of replacing the first', async () => {
    const seen: string[] = []
    const events = () => {
      seen.push('events')
    }
    const hero = () => {
      seen.push('hero')
    }
    registerPaymentConsumerHook('events.confirmRegistration', events)
    registerPaymentConsumerHook('events.confirmRegistration', hero)
    assert.equal(getPaymentConsumerHook('events.confirmRegistration'), events)
    await runPaymentConsumerHook('events.confirmRegistration', ctx)
    assert.deepEqual(seen, ['events', 'hero'])
  })

  it('does not mark an order paid; the first throw aborts and later listeners are isolated', async () => {
    // Payments updates the order before runPaymentConsumerHook (transitionToPaid,
    // claimOpenCheckoutExpired, requestOrderRefund). This runner must not write
    // order status. A throw from the first handler still rejects, and later
    // handlers do not run — the same abort as the old single-handler await.
    // A throw from a later listener is logged and swallowed so the remaining
    // listeners still run and the request does not fail. That cannot mark the
    // order paid a second time, because this function never touches the order.
    let paidWrites = 0

    registerPaymentConsumerHook('events.confirmRegistration', async () => {
      throw new Error('owner failed')
    })
    registerPaymentConsumerHook('events.confirmRegistration', async () => {
      paidWrites += 1
    })
    await assert.rejects(
      () => runPaymentConsumerHook('events.confirmRegistration', ctx),
      /owner failed/,
    )
    assert.equal(paidWrites, 0)

    clearPaymentConsumerHooks()
    const seen: string[] = []
    const errors: unknown[] = []
    const original = console.error
    console.error = (...args: unknown[]) => {
      errors.push(args)
    }
    try {
      registerPaymentConsumerHook('events.confirmRegistration', async () => {
        seen.push('owner')
      })
      registerPaymentConsumerHook('events.confirmRegistration', async () => {
        seen.push('hero')
        throw new Error('hero failed')
      })
      registerPaymentConsumerHook('events.confirmRegistration', async () => {
        seen.push('after')
      })
      await runPaymentConsumerHook('events.confirmRegistration', ctx)
      assert.deepEqual(seen, ['owner', 'hero', 'after'])
      assert.equal(errors.length, 1)
      assert.equal(paidWrites, 0)
    } finally {
      console.error = original
    }
  })
})
