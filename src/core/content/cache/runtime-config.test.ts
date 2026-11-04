import assert from 'node:assert/strict'
import { describe, it, beforeEach } from 'node:test'

import {
  getPublishedCacheRuntimeConfig,
  resetPublishedCacheRuntimeConfig,
  setPublishedCacheRuntimeConfig,
} from './runtime-config'

describe('published cache runtime config snapshot', () => {
  beforeEach(() => {
    resetPublishedCacheRuntimeConfig()
  })

  it('starts at Site Settings defaults', () => {
    const cfg = getPublishedCacheRuntimeConfig()
    assert.equal(cfg.enabled, true)
    assert.equal(cfg.ttlSec, 0)
    assert.equal(cfg.nullMissTtlSec, 60)
  })

  it('updates and clamps partial writes', () => {
    setPublishedCacheRuntimeConfig({
      enabled: false,
      ttlSec: 300,
      nullMissTtlSec: 15,
    })
    let cfg = getPublishedCacheRuntimeConfig()
    assert.equal(cfg.enabled, false)
    assert.equal(cfg.ttlSec, 300)
    assert.equal(cfg.nullMissTtlSec, 15)

    setPublishedCacheRuntimeConfig({ ttlSec: 999_999 })
    cfg = getPublishedCacheRuntimeConfig()
    assert.equal(cfg.enabled, false)
    assert.equal(cfg.ttlSec, 86_400)
    assert.equal(cfg.nullMissTtlSec, 15)
  })
})
