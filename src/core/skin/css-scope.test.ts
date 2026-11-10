import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  outlineBodyClass,
  sanitizeCssScopeId,
  skinBodyClass,
  skinBodySelector,
  skinOutlineBodySelector,
} from './css-scope'
import { buildSkinRootCss } from './css-vars'
import { starforgePastelTokens } from './skins/starforge-pastel/tokens'

describe('skin css-scope', () => {
  it('sanitizes ids for CSS classes', () => {
    assert.equal(sanitizeCssScopeId('starforge-pastel'), 'starforge-pastel')
    assert.equal(sanitizeCssScopeId('bad id!'), 'badid')
    assert.equal(sanitizeCssScopeId(''), 'default')
  })

  it('builds unique skin and outline body classes', () => {
    assert.equal(skinBodyClass('starforge-pastel'), 'sf-skin-starforge-pastel')
    assert.equal(
      outlineBodyClass('starforge-pastel-test'),
      'sf-outline-starforge-pastel-test',
    )
  })

  it('builds hierarchy selectors so outline compounds skin', () => {
    assert.equal(skinBodySelector('starforge-pastel'), 'body.sf-skin-starforge-pastel')
    assert.equal(
      skinOutlineBodySelector('starforge-pastel', 'starforge-pastel-test'),
      'body.sf-skin-starforge-pastel.sf-outline-starforge-pastel-test',
    )
  })
})

describe('buildSkinRootCss', () => {
  it('scopes tokens to body.sf-skin-* (not :root)', () => {
    const css = buildSkinRootCss('starforge-pastel', starforgePastelTokens)
    assert.match(css, /body\.sf-skin-starforge-pastel\s*\{/)
    assert.doesNotMatch(css, /:root\s*\{/)
    assert.match(css, /--sf-primary:\s*#f2a66a;/)
  })
})
