import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildOutlineBodyBackgroundCss,
  buildOutlineBreakpointCss,
  buildSectionInlineStyle,
  DEFAULT_LAYOUT_BREAKPOINTS,
  formatLayoutBoxSpacing,
  normalizeLayoutOutlineStyles,
  normalizeLayoutSectionStyles,
  parseLayoutBoxSpacing,
  resolveSectionContainerMode,
  sanitizeCssBoxShorthand,
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

describe('section padding / margin box spacing', () => {
  it('formats four numbers + unit into CSS shorthand', () => {
    assert.equal(
      formatLayoutBoxSpacing({ top: '1', right: '1.5', bottom: '1', left: '1.5', unit: 'rem' }),
      '1rem 1.5rem 1rem 1.5rem',
    )
    assert.equal(
      formatLayoutBoxSpacing({ top: '10', right: '', bottom: '0', left: '5', unit: 'px' }),
      '10px 0px 0px 5px',
    )
    assert.equal(
      formatLayoutBoxSpacing({ top: '', right: '', bottom: '', left: '', unit: 'rem' }),
      undefined,
    )
  })

  it('rejects negative padding but allows negative margin', () => {
    assert.equal(
      formatLayoutBoxSpacing({ top: '-1', right: '0', bottom: '0', left: '0', unit: 'rem' }),
      undefined,
    )
    assert.equal(
      formatLayoutBoxSpacing(
        { top: '-1', right: '0', bottom: '0', left: '0', unit: 'rem' },
        { allowNegative: true },
      ),
      '-1rem 0rem 0rem 0rem',
    )
    assert.equal(sanitizeCssBoxShorthand('-1rem 0rem 0rem 0rem'), undefined)
    assert.equal(
      sanitizeCssBoxShorthand('-1rem 0rem 0rem 0rem', { allowNegative: true }),
      '-1rem 0rem 0rem 0rem',
    )
  })

  it('parses shorthand back into cog draft', () => {
    assert.deepEqual(parseLayoutBoxSpacing('1rem 2rem 1rem 2rem'), {
      top: '1',
      right: '2',
      bottom: '1',
      left: '2',
      unit: 'rem',
    })
    assert.deepEqual(parseLayoutBoxSpacing('8px'), {
      top: '8',
      right: '8',
      bottom: '8',
      left: '8',
      unit: 'px',
    })
  })

  it('stores and emits padding/margin on section inline styles', () => {
    const styles = normalizeLayoutSectionStyles({
      padding: '1rem 2rem 1rem 2rem',
      margin: '0px 0px 16px 0px',
    })
    assert.equal(styles?.padding, '1rem 2rem 1rem 2rem')
    assert.equal(styles?.margin, '0px 0px 16px 0px')
    const inline = buildSectionInlineStyle(styles)
    assert.equal(inline?.padding, '1rem 2rem 1rem 2rem')
    assert.equal(inline?.margin, '0px 0px 16px 0px')
  })
})
