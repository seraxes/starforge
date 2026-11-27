import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { runOnboardingDoor } from './door'

describe('runOnboardingDoor (off door)', () => {
  it('runs work and returns the value when Onboarding is on (success path)', async () => {
    let called = 0
    const result = await runOnboardingDoor(true, async () => {
      called += 1
      return 'ok'
    })
    assert.deepEqual(result, { ok: true, value: 'ok' })
    assert.equal(called, 1)
  })

  it('returns immediately with disabled when Onboarding is off (failure path)', async () => {
    let called = 0
    const result = await runOnboardingDoor(false, () => {
      called += 1
      return 'should-not-run'
    })
    assert.deepEqual(result, { ok: false, reason: 'disabled' })
    assert.equal(called, 0)
  })
})
