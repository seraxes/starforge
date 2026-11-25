import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  parsePackagePrice,
  validatePackageFields,
  validatePlacementFields,
} from './catalog'

describe('ads package catalog validation', () => {
  it('accepts a titled package with zero or positive price', () => {
    const ok = validatePackageFields({
      title: 'Feed boost',
      description: 'Credits for social feed',
      price: 5000,
      creditGrant: 10,
      active: true,
      sortOrder: 1,
    })
    assert.equal(ok.ok, true)
    if (!ok.ok) return
    assert.equal(ok.values.title, 'Feed boost')
    assert.equal(ok.values.price, 5000)
    assert.equal(ok.values.creditGrant, 10)
    assert.equal(ok.values.active, true)

    const free = validatePackageFields({ title: 'Complimentary', price: 0 })
    assert.equal(free.ok, true)
    if (!free.ok) return
    assert.equal(free.values.price, 0)
  })

  it('refuses an empty title', () => {
    const blank = validatePackageFields({ title: '   ', price: 100 })
    assert.equal(blank.ok, false)
    if (blank.ok) return
    assert.match(blank.error, /title/i)

    const missing = validatePackageFields({ price: 100 })
    assert.equal(missing.ok, false)
    if (missing.ok) return
    assert.match(missing.error, /title/i)
  })

  it('refuses a negative price', () => {
    const neg = validatePackageFields({ title: 'Bad', price: -1 })
    assert.equal(neg.ok, false)
    if (neg.ok) return
    assert.match(neg.error, /negative/i)

    const priceOnly = parsePackagePrice(-50)
    assert.equal(priceOnly.ok, false)
    if (priceOnly.ok) return
    assert.match(priceOnly.error, /negative/i)
  })
})

describe('ads placement catalog validation', () => {
  it('accepts a labeled placement with a slug key', () => {
    const ok = validatePlacementFields({
      label: 'Social feed',
      key: 'social_feed',
      enabled: true,
    })
    assert.equal(ok.ok, true)
    if (!ok.ok) return
    assert.equal(ok.values.key, 'social_feed')
  })

  it('refuses empty label or invalid key', () => {
    const noLabel = validatePlacementFields({ label: '', key: 'social_feed' })
    assert.equal(noLabel.ok, false)
    if (noLabel.ok) return
    assert.match(noLabel.error, /label/i)

    const badKey = validatePlacementFields({ label: 'Feed', key: 'Social Feed!' })
    assert.equal(badKey.ok, false)
    if (badKey.ok) return
    assert.match(badKey.error, /key/i)
  })
})
