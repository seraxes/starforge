import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildOutlineBodyBackgroundCss,
  buildOutlineBreakpointCss,
  DEFAULT_LAYOUT_BREAKPOINTS,
  normalizeLayoutOutlineStyles,
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

describe('buildOutlineBodyBackgroundCss', () => {
  it('paints a fixed cover image on the outline body and clears the footer fill', () => {
    const css = buildOutlineBodyBackgroundCss('starforge-pastel-default', 'starforge-pastel', {
      backgroundImage: '/api/media/file/sf-bg01.webp',
      backgroundSize: 'cover',
      backgroundAttachment: 'fixed',
      backgroundRepeat: 'no-repeat',
    })
    assert.match(css, /body\.sf-skin-starforge-pastel\.sf-outline-starforge-pastel-default\{/)
    assert.match(css, /background-image:url\("\/api\/media\/file\/sf-bg01\.webp"\)/)
    assert.match(css, /background-attachment:fixed/)
    assert.match(css, /\.site-footer\{background-color:transparent/)
  })

  it('skips a disabled page background', () => {
    assert.equal(
      buildOutlineBodyBackgroundCss('default', 'starforge-pastel', {
        disabled: true,
        backgroundImage: '/bg.webp',
      }),
      '',
    )
  })

  it('keeps page background beside breakpoints when normalizing', () => {
    const styles = normalizeLayoutOutlineStyles({
      breakpoints: DEFAULT_LAYOUT_BREAKPOINTS,
      body: { backgroundMediaId: 'bg1', backgroundColor: '#112233' },
    })
    assert.equal(styles?.body?.backgroundMediaId, 'bg1')
    assert.equal(styles?.body?.backgroundColor, '#112233')
    assert.equal(styles?.breakpoints?.largeDesktop, '75rem')
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
