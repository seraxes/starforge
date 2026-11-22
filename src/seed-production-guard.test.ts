import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { assertSeedAllowed } from './seed-production-guard'

describe('assertSeedAllowed', () => {
  it('allows development', () => {
    assert.doesNotThrow(() => assertSeedAllowed({ NODE_ENV: 'development' }))
  })

  it('allows unset NODE_ENV (CI seed step)', () => {
    assert.doesNotThrow(() => assertSeedAllowed({}))
  })

  it('throws in production without the allow flag', () => {
    assert.throws(
      () => assertSeedAllowed({ NODE_ENV: 'production' }),
      /Refusing to seed when NODE_ENV=production/,
    )
  })

  it('allows production when STARFORGE_ALLOW_PRODUCTION_SEED=1', () => {
    assert.doesNotThrow(() =>
      assertSeedAllowed({
        NODE_ENV: 'production',
        STARFORGE_ALLOW_PRODUCTION_SEED: '1',
      }),
    )
  })
})
