import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { sanitizeCssClassList, sanitizeHtmlId, slugifyLayoutId } from './document'

describe('layout document helpers', () => {
  it('slugifies labels', () => {
    assert.equal(slugifyLayoutId('Base Outline'), 'base-outline')
    assert.equal(slugifyLayoutId('!!!'), 'untitled')
  })

  it('sanitizes css class lists', () => {
    assert.equal(sanitizeCssClassList('hero primary 1bad'), 'hero primary')
    assert.equal(sanitizeCssClassList(''), undefined)
  })

  it('sanitizes html ids', () => {
    assert.equal(sanitizeHtmlId('main-nav'), 'main-nav')
    assert.equal(sanitizeHtmlId('1bad'), undefined)
  })
})
