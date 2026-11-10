import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildOutlineBreakpointCss,
  DEFAULT_LAYOUT_BREAKPOINTS,
  resolveSectionContainerMode,
} from './styles'

describe('buildOutlineBreakpointCss', () => {
  it('emits body.sf-skin-*.sf-outline-* with container-max', () => {
    const css = buildOutlineBreakpointCss(
      'starforge-pastel-test',
      DEFAULT_LAYOUT_BREAKPOINTS,
      'starforge-pastel',
    )
    assert.match(
      css,
      /body\.sf-skin-starforge-pastel\.sf-outline-starforge-pastel-test\{/,
    )
    assert.match(css, /--sf-container-max:75rem;/)
    assert.doesNotMatch(css, /public-shell\[data-sf-layout-id/)
  })
})

describe('resolveSectionContainerMode', () => {
  it('section mode wins over page default', () => {
    assert.equal(resolveSectionContainerMode('boxed', 'fullwidth'), 'boxed')
    assert.equal(resolveSectionContainerMode('full', 'boxed'), 'full')
  })

  it('page default fills when section omits mode', () => {
    assert.equal(resolveSectionContainerMode(undefined, 'boxed'), 'boxed')
    assert.equal(resolveSectionContainerMode(undefined, 'fullwidth'), 'full')
    assert.equal(resolveSectionContainerMode(null, undefined), 'full')
  })
})
