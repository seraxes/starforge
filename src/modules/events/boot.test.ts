import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { bootEvents } from './boot'

type SweepGlobal = typeof globalThis & {
  __sfEventsAbandonedCheckoutSweep?: boolean
}

describe('bootEvents', () => {
  it('leaves the abandoned-checkout sweep global unset when Events is disabled', async () => {
    const g = globalThis as SweepGlobal
    delete g.__sfEventsAbandonedCheckoutSweep
    await bootEvents({ isEnabled: async () => false })
    assert.equal(g.__sfEventsAbandonedCheckoutSweep, undefined)
  })
})
