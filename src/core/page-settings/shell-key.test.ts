import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  normalizePublicPath,
  publicShellKeyMatches,
  sanitizePublicShellPath,
  type PublicShellKey,
} from './shell-key'

const boxed: PublicShellKey = {
  layoutId: 'starforge-boxed',
  outlineId: 'starforge-boxed',
  sectionsLayout: 'boxed',
}

describe('public shell key', () => {
  it('normalizes locale paths the way the router reports them', () => {
    assert.equal(normalizePublicPath('/en/events/'), '/en/events')
    assert.equal(normalizePublicPath('/en'), '/en')
    assert.equal(normalizePublicPath('en/about?x=1#y'), '/en/about')
    assert.equal(normalizePublicPath(''), '/')
  })

  it('rejects non-paths before a shell lookup', () => {
    assert.equal(sanitizePublicShellPath('https://evil.example/en'), null)
    assert.equal(sanitizePublicShellPath('//evil.example/en'), null)
    assert.equal(sanitizePublicShellPath('/en/events'), '/en/events')
  })

  it('treats outline and sections width as the shell identity', () => {
    assert.equal(publicShellKeyMatches(boxed, { ...boxed }), true)
    assert.equal(
      publicShellKeyMatches(boxed, { ...boxed, sectionsLayout: 'fullwidth' }),
      false,
    )
    assert.equal(
      publicShellKeyMatches(boxed, { ...boxed, layoutId: 'starforge-full' }),
      false,
    )
    assert.equal(
      publicShellKeyMatches(boxed, { ...boxed, outlineId: 'starforge-full' }),
      false,
    )
  })
})
