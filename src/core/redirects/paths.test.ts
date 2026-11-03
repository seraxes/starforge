import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { normalizeRedirectFromPath } from './paths'

describe('normalizeRedirectFromPath', () => {
  it('adds a leading slash and drops trailing slash', () => {
    assert.equal(normalizeRedirectFromPath('about/'), '/about')
    assert.equal(normalizeRedirectFromPath('/about/'), '/about')
  })

  it('keeps root as /', () => {
    assert.equal(normalizeRedirectFromPath('/'), '/')
  })

  it('strips query and hash', () => {
    assert.equal(normalizeRedirectFromPath('/x?y=1#z'), '/x')
  })

  it('extracts pathname from absolute URL', () => {
    assert.equal(normalizeRedirectFromPath('https://example.com/old/path/'), '/old/path')
  })
})
