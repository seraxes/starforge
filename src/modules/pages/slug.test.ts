import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildPageKey, parseContentLocaleKey } from '@/core/i18n/content-locale-keys'

import { normalizePageSlug } from './slug'

describe('page slug', () => {
  it('keeps home and slugifies the rest', () => {
    assert.equal(normalizePageSlug('home'), 'home')
    assert.equal(normalizePageSlug('/HOME/'), 'home')
    assert.equal(normalizePageSlug('About Us'), 'about-us')
    assert.equal(normalizePageSlug(''), '')
  })
})

describe('page content-locale keys', () => {
  it('round-trips a page body key', () => {
    const key = buildPageKey('page-1', 'html')
    assert.equal(key, 'pages.page-1.html')
    const parsed = parseContentLocaleKey(key)
    assert.equal(parsed?.kind, 'page')
    if (parsed?.kind === 'page') {
      assert.equal(parsed.pageId, 'page-1')
      assert.equal(parsed.field, 'html')
    }
    assert.equal(parseContentLocaleKey('pages.page-1.milsim'), null)
  })
})
