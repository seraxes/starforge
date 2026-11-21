import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { bootSocial } from './boot'

type SweepGlobal = typeof globalThis & {
  __sfSocialSweep?: boolean
}

describe('bootSocial', () => {
  it('leaves the social.sweep global unset when Social is disabled', async () => {
    const g = globalThis as SweepGlobal
    delete g.__sfSocialSweep
    await bootSocial({ isEnabled: async () => false })
    assert.equal(g.__sfSocialSweep, undefined)
  })
})
