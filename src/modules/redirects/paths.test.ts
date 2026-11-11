import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  normalizeRedirectFromPath,
  normalizeRedirectToPath,
  resolveLocaleAwareRedirectPath,
} from './paths'

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

  it('strips locale prefixes (path-relative policy)', () => {
    assert.equal(normalizeRedirectFromPath('/en/about'), '/about')
    assert.equal(normalizeRedirectFromPath('/hu/old'), '/old')
    assert.equal(normalizeRedirectFromPath('/en'), '/')
  })
})

describe('resolveLocaleAwareRedirectPath', () => {
  it('re-prefixes relative destinations with the request locale', () => {
    assert.equal(resolveLocaleAwareRedirectPath('/contact', 'hu'), '/hu/contact')
    assert.equal(resolveLocaleAwareRedirectPath('/en/contact', 'en'), '/en/contact')
    assert.equal(resolveLocaleAwareRedirectPath('/', 'en'), '/en')
  })

  it('passes absolute URLs through', () => {
    assert.equal(
      resolveLocaleAwareRedirectPath('https://example.com/x', 'hu'),
      'https://example.com/x',
    )
  })

  it('strips locale on relative to-path normalize', () => {
    assert.equal(normalizeRedirectToPath('/hu/new'), '/new')
  })
})
