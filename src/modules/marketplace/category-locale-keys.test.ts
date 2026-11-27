import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildMarketplaceCategoryKey,
  contentLocaleFileRefForKey,
  parseContentLocaleKey,
} from '@/core/i18n/content-locale-keys'

test('marketplace category locale keys round-trip', () => {
  const key = buildMarketplaceCategoryKey('cat-1', 'title')
  assert.equal(key, 'marketplace.category.cat-1.title')
  const parsed = parseContentLocaleKey(key)
  assert.equal(parsed?.kind, 'marketplace-category')
  if (parsed?.kind === 'marketplace-category') {
    assert.equal(parsed.categoryId, 'cat-1')
    assert.equal(parsed.field, 'title')
  }
  assert.deepEqual(contentLocaleFileRefForKey(key), {
    scope: 'marketplace',
    ownerId: 'cat-1',
  })
})

test('marketplace category locale keys refuse an unknown field', () => {
  assert.equal(parseContentLocaleKey('marketplace.category.cat-1.milsim'), null)
  assert.equal(parseContentLocaleKey('marketplace.category.cat-1.html'), null)
})
