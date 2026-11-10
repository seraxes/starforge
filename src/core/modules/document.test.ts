import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  cloneWorkingLayoutDocument,
  sanitizeCssClassList,
  sanitizeHtmlId,
  slugifyLayoutId,
} from './document'

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

  it('preserves empty inheriting stubs when cloning for mutate', () => {
    const child = {
      version: 3 as const,
      inheritFrom: 'starforge-pastel-default',
      sections: [] as [],
    }
    const working = cloneWorkingLayoutDocument(child)
    assert.equal(working.inheritFrom, 'starforge-pastel-default')
    assert.equal(working.sections.length, 0)
    assert.notEqual(working, child)
  })
})
