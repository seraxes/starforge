import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildOutlineBodyBackgroundCss,
  buildOutlineBreakpointCss,
  buildOutlineTypographyCss,
  buildSectionInlineStyle,
  DEFAULT_LAYOUT_BREAKPOINTS,
  formatLayoutBoxSpacing,
  normalizeLayoutOutlineStyles,
  normalizeLayoutSectionStyles,
  normalizeLayoutTypography,
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

  it('paints a gradient fill and a color or gradient overlay above the image', () => {
    const css = buildOutlineBodyBackgroundCss('starforge-pastel-default', 'starforge-pastel', {
      backgroundColor: 'linear-gradient(180deg, #1c2834 0%, #8ebad4 100%)',
      allowGradientBackground: true,
      backgroundImage: '/api/media/file/sf-bg01.webp',
      backgroundSize: 'cover',
      backgroundAttachment: 'fixed',
      backgroundRepeat: 'no-repeat',
      backgroundOverlay: 'enabled',
      overlayColor: 'linear-gradient(180deg, rgba(0,0,0,0.45), transparent)',
      allowGradientOverlay: true,
    })
    assert.match(
      css,
      /background-image:url\("\/api\/media\/file\/sf-bg01\.webp"\),linear-gradient\(180deg, #1c2834 0%, #8ebad4 100%\)/,
    )
    assert.match(css, /::before\{content:"";position:fixed;/)
    assert.match(css, /background:linear-gradient\(180deg, rgba\(0,0,0,0\.45\), transparent\)/)
  })

  it('drops gradients unless the gradient flag is on, and rejects url() inside them', () => {
    const stripped = normalizeLayoutOutlineStyles({
      body: {
        backgroundColor: 'linear-gradient(180deg, #111, #222)',
        overlayColor: 'linear-gradient(red, url(https://evil))',
        allowGradientOverlay: true,
        backgroundOverlay: 'enabled',
      },
    })
    assert.equal(stripped?.body?.backgroundColor, undefined)
    assert.equal(stripped?.body?.overlayColor, undefined)
    assert.equal(stripped?.body?.backgroundOverlay, 'enabled')
    const css = buildOutlineBodyBackgroundCss('default', 'starforge-pastel', stripped?.body)
    assert.match(css, /background:rgba\(0,0,0,0\.35\)/)
    assert.doesNotMatch(css, /url\(|evil/)
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

describe('buildOutlineTypographyCss', () => {
  it('emits title and text fonts plus accent and hover on the outline body', () => {
    const css = buildOutlineTypographyCss('starforge-pastel-default', 'starforge-pastel', {
      titleFont: 'georgia',
      textFont: 'verdana',
      titleColor: '#112233',
      textColor: '#445566',
      linkColor: '#A85220',
      linkHoverColor: '#f2a66a',
    })
    assert.match(css, /body\.sf-skin-starforge-pastel\.sf-outline-starforge-pastel-default\{/)
    assert.match(css, /--font-display:Georgia, 'Times New Roman', serif;/)
    assert.match(css, /--font-body:Verdana, Geneva, sans-serif;/)
    assert.match(css, /--sf-title-color:#112233;/)
    assert.match(css, /--sf-ink:#445566;/)
    assert.match(css, /--sf-accent:#a85220;/)
    assert.match(css, /--sf-link-hover:#f2a66a;/)
    assert.match(css, /:is\(h1,h2,h3,h4,h5,h6\)\{font-family:var\(--font-display\);color:var\(--sf-section-text, var\(--sf-title-color\)\);\}/)
    assert.match(css, /a:not\(\.button-link\):hover\{color:var\(--sf-link-hover\);\}/)
  })

  it('drops unknown fonts and unsafe colors', () => {
    const normalized = normalizeLayoutTypography({
      titleFont: "georgia;}.x{color:red",
      textFont: 'not-a-font',
      titleColor: '#fff;}body{background:url(https://evil)',
      textColor: 'expression(alert(1))',
      linkColor: '#abc',
      linkHoverColor: 'javascript:alert(1)',
    })
    assert.equal(normalized?.titleFont, undefined)
    assert.equal(normalized?.textFont, undefined)
    assert.equal(normalized?.titleColor, undefined)
    assert.equal(normalized?.textColor, undefined)
    assert.equal(normalized?.linkColor, '#abc')
    assert.equal(normalized?.linkHoverColor, undefined)
    assert.equal(
      buildOutlineTypographyCss('default', 'starforge-pastel', {
        titleFont: "georgia;}.x{color:red",
        textColor: 'expression(alert(1))',
      }),
      '',
    )
    const css = buildOutlineTypographyCss('default', 'starforge-pastel', {
      ...normalized,
      textFont: 'verdana',
    })
    assert.match(css, /--font-body:Verdana/)
    assert.match(css, /--sf-link:#abc;/)
    assert.doesNotMatch(css, /expression|javascript|evil/)
  })

  it('skips a disabled type block and keeps type beside page background', () => {
    assert.equal(
      buildOutlineTypographyCss('default', 'starforge-pastel', {
        disabled: true,
        titleFont: 'georgia',
        titleColor: '#112233',
      }),
      '',
    )
    const styles = normalizeLayoutOutlineStyles({
      body: { backgroundColor: '#112233' },
      typography: { titleFont: 'georgia', linkColor: 'not-a-color', textFont: 'verdana' },
    })
    assert.equal(styles?.body?.backgroundColor, '#112233')
    assert.equal(styles?.typography?.titleFont, 'georgia')
    assert.equal(styles?.typography?.textFont, 'verdana')
    assert.equal(styles?.typography?.linkColor, undefined)
    assert.equal(normalizeLayoutTypography({}), undefined)
    assert.equal(normalizeLayoutTypography({ disabled: true })?.disabled, true)
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
