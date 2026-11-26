import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { readSocialGroupsConfig } from './social-groups-config'

describe('readSocialGroupsConfig', () => {
  it('defaults to viewer scope with images on', () => {
    const cfg = readSocialGroupsConfig({})
    assert.equal(cfg.source, 'viewer')
    assert.equal(cfg.showImages, true)
    assert.deepEqual(cfg.scopeIds, [])
  })

  it('reads selected group ids and showImages off', () => {
    const cfg = readSocialGroupsConfig({
      source: 'groups',
      scopeIds: 'g1, g2',
      showImages: false,
      limit: 4,
    })
    assert.equal(cfg.source, 'groups')
    assert.deepEqual(cfg.scopeIds, ['g1', 'g2'])
    assert.equal(cfg.showImages, false)
    assert.equal(cfg.limit, 4)
  })
})
