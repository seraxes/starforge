import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { readSocialPagesConfig } from './social-pages-config'

describe('readSocialPagesConfig', () => {
  it('defaults to viewer liked pages', () => {
    const cfg = readSocialPagesConfig(undefined)
    assert.equal(cfg.source, 'viewer')
    assert.equal(cfg.showImages, true)
  })

  it('accepts all directory scope', () => {
    const cfg = readSocialPagesConfig({ source: 'all', heading: 'Explore' })
    assert.equal(cfg.source, 'all')
    assert.equal(cfg.heading, 'Explore')
  })
})
