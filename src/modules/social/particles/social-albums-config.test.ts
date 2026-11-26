import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { readSocialAlbumsConfig } from './social-albums-config'

describe('readSocialAlbumsConfig', () => {
  it('defaults to viewer albums', () => {
    const cfg = readSocialAlbumsConfig({})
    assert.equal(cfg.source, 'viewer')
    assert.equal(cfg.limit, 12)
  })

  it('reads groups scope ids and caps limit at 48', () => {
    const cfg = readSocialAlbumsConfig({
      source: 'groups',
      groupIds: 'team-a team-b',
      limit: 99,
    })
    assert.equal(cfg.source, 'groups')
    assert.deepEqual(cfg.scopeIds, ['team-a', 'team-b'])
    assert.equal(cfg.limit, 48)
  })
})
