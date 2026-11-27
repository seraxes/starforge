import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { validateCategoryFields } from './category-rules'

describe('marketplace category field validation', () => {
  it('accepts a titled enabled category', () => {
    const ok = validateCategoryFields({
      title: 'Used gear',
      description: 'Pre-owned equipment',
      enabled: true,
      sortOrder: 1,
    })
    assert.equal(ok.ok, true)
    if (!ok.ok) return
    assert.equal(ok.values.title, 'Used gear')
    assert.equal(ok.values.enabled, true)
    assert.equal(ok.values.sortOrder, 1)
    assert.equal(ok.values.slug, 'used-gear')
  })

  it('refuses an empty title', () => {
    const blank = validateCategoryFields({ title: '   ', enabled: true })
    assert.equal(blank.ok, false)
    if (blank.ok) return
    assert.match(blank.error, /title/i)

    const missing = validateCategoryFields({ enabled: true })
    assert.equal(missing.ok, false)
    if (missing.ok) return
    assert.match(missing.error, /title/i)
  })
})
