import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  parseSocialParticleScopeIds,
  readSocialParticleLimit,
  readSocialParticleShowImages,
  readSocialParticleSource,
} from './social-particle-scope'

describe('social particle scope helpers', () => {
  it('parses unique comma and whitespace ids', () => {
    assert.deepEqual(parseSocialParticleScopeIds('a, b  c,a'), ['a', 'b', 'c'])
    assert.deepEqual(parseSocialParticleScopeIds(''), [])
    assert.deepEqual(parseSocialParticleScopeIds(null), [])
  })

  it('reads source with fallback on invalid values', () => {
    assert.equal(readSocialParticleSource({ source: 'all' }), 'all')
    assert.equal(readSocialParticleSource({ source: 'groups' }), 'groups')
    assert.equal(readSocialParticleSource({ source: 'nope' }, 'viewer'), 'viewer')
  })

  it('reads showImages flags', () => {
    assert.equal(readSocialParticleShowImages({ showImages: false }), false)
    assert.equal(readSocialParticleShowImages({ showImages: 'false' }), false)
    assert.equal(readSocialParticleShowImages({ showImages: true }), true)
    assert.equal(readSocialParticleShowImages({}), true)
  })

  it('caps and floors limit; falls back on bad values', () => {
    assert.equal(readSocialParticleLimit({ limit: 12 }, 8), 12)
    assert.equal(readSocialParticleLimit({ limit: 999 }, 8), 100)
    assert.equal(readSocialParticleLimit({ limit: 0 }, 8), 8)
    assert.equal(readSocialParticleLimit({ limit: 'x' }, 8), 8)
  })
})
