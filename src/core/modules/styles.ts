/**
 * Outline-scoped layout styles (SF-34 / SF-64).
 *
 * CSS ownership (keep layers separate — do not mix into admin chrome):
 * 1) Design tokens — `:root` (later Tailwind theme)
 * 2) Outline Layout Styles — section full/boxed + section bg/text/image/overlay
 *    + outline breakpoints
 * 3) Custom CSS — Page Settings / Custom particle (not admin chrome)
 *
 * Section Styles live on each live section instance (`section.styles`) — listing
 * under Layouts → Styles mirrors the outline canvas; deleting a section drops
 * its styles with it. Breakpoints stay on `document.styles.breakpoints`.
 */

import type { CSSProperties } from 'react'

export type LayoutContainerMode = 'full' | 'boxed'

/**
 * Gantry-like Section Styles on a layout section instance (not a fixed name list).
 * Live sections only — no Navigation/Header preset name map.
 */
export type LayoutSectionStyles = {
  /** Hex / transparent fill, or CSS gradient when allowGradientBackground. */
  backgroundColor?: string
  /** Hex text / foreground color (inherits into section content). */
  textColor?: string
  /** Background image URL (http(s), /, or data:). */
  backgroundImage?: string
  /** Gantry-style Background Overlay toggle. */
  backgroundOverlay?: 'enabled' | 'disabled'
  /** Overlay fill (hex / transparent, or gradient when allowGradientOverlay). */
  overlayColor?: string
  /** Permit CSS gradient syntax in backgroundColor. */
  allowGradientBackground?: boolean
  /** Permit CSS gradient syntax in overlayColor. */
  allowGradientOverlay?: boolean
}

export type LayoutBreakpoints = {
  /** min-width threshold for large desktop (typically 75rem). */
  largeDesktop: string
  /** desktop floor (typically 60rem). */
  desktop: string
  /** tablet floor (typically 48rem). */
  tablet: string
  /** mobile / large-mobile ceiling (typically 30rem). */
  mobile: string
  /** width at/below which the mobile menu treatment applies (typically 48rem). */
  mobileMenu: string
}

/** Outline document `styles` bag (breakpoints now; accents later). */
export type LayoutDocumentStyles = {
  breakpoints: LayoutBreakpoints
}

/** Gantry Helium–style rem presets (16px root). */
export const DEFAULT_LAYOUT_BREAKPOINTS: LayoutBreakpoints = {
  largeDesktop: '75rem',
  desktop: '60rem',
  tablet: '48rem',
  mobile: '30rem',
  mobileMenu: '48rem',
}

const LENGTH_RE = /^\d+(\.\d+)?(rem|em|px|%)$/i

/** Accept rem/em/px/% lengths; reject empty / unsafe strings. */
export function sanitizeCssLength(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback
  const trimmed = raw.trim().toLowerCase()
  if (!LENGTH_RE.test(trimmed)) return fallback
  return trimmed
}

export function normalizeLayoutBreakpoints(raw: unknown): LayoutBreakpoints {
  const src =
    raw && typeof raw === 'object' ? (raw as Partial<Record<keyof LayoutBreakpoints, unknown>>) : {}
  return {
    largeDesktop: sanitizeCssLength(src.largeDesktop, DEFAULT_LAYOUT_BREAKPOINTS.largeDesktop),
    desktop: sanitizeCssLength(src.desktop, DEFAULT_LAYOUT_BREAKPOINTS.desktop),
    tablet: sanitizeCssLength(src.tablet, DEFAULT_LAYOUT_BREAKPOINTS.tablet),
    mobile: sanitizeCssLength(src.mobile, DEFAULT_LAYOUT_BREAKPOINTS.mobile),
    mobileMenu: sanitizeCssLength(src.mobileMenu, DEFAULT_LAYOUT_BREAKPOINTS.mobileMenu),
  }
}

export function normalizeLayoutOutlineStyles(raw: unknown): LayoutDocumentStyles | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const breakpointsRaw = (raw as { breakpoints?: unknown }).breakpoints
  if (breakpointsRaw === undefined) return undefined
  return { breakpoints: normalizeLayoutBreakpoints(breakpointsRaw) }
}

/** Resolve section container mode; page default fills when section omits the field. */
export function resolveSectionContainerMode(
  sectionMode: LayoutContainerMode | undefined | null,
  pageDefault: 'fullwidth' | 'boxed' | undefined = 'fullwidth',
): LayoutContainerMode {
  if (sectionMode === 'full' || sectionMode === 'boxed') return sectionMode
  return pageDefault === 'boxed' ? 'boxed' : 'full'
}

export function asContainerMode(raw: unknown): LayoutContainerMode | undefined {
  if (raw === 'full' || raw === 'boxed') return raw
  if (raw === 'fullwidth') return 'full'
  return undefined
}

const HEX_COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const RGB_COLOR_RE =
  /^rgba?\(\s*([0-9]{1,3}%?)\s*,\s*([0-9]{1,3}%?)\s*,\s*([0-9]{1,3}%?)\s*(?:,\s*(0|1|0?\.\d+)\s*)?\)$/i
const HSL_COLOR_RE =
  /^hsla?\(\s*(-?[0-9]{1,3}(?:\.\d+)?(?:deg|rad|turn)?)\s*,\s*([0-9]{1,3}(?:\.\d+)?%)\s*,\s*([0-9]{1,3}(?:\.\d+)?%)\s*(?:,\s*(0|1|0?\.\d+)\s*)?\)$/i

/** CSS Level 4 named colors (lowercase) — logo text color allowlist. */
const CSS_NAMED_COLORS = new Set(
  `
  aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue
  blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk
  crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki
  darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen
  darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue
  dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite
  gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki
  lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan
  lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen
  lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen
  linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen
  mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream
  mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid
  palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum
  powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown
  seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen
  steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow
  yellowgreen
  `
    .trim()
    .split(/\s+/),
)

export type CssColorParseResult =
  | { status: 'empty' }
  | { status: 'ok'; value: string }
  | { status: 'invalid' }

/**
 * Accept hex / rgb(a) / hsl(a) / transparent / currentColor / CSS named colors.
 * Used for Logo text color (broader than section hex-only sanitizer).
 */
export function parseCssColorInput(raw: unknown): CssColorParseResult {
  if (typeof raw !== 'string') return { status: 'invalid' }
  const trimmed = raw.trim()
  if (!trimmed) return { status: 'empty' }
  const lower = trimmed.toLowerCase()
  if (lower === 'transparent' || lower === 'currentcolor') {
    return { status: 'ok', value: lower }
  }
  if (HEX_COLOR_RE.test(trimmed)) return { status: 'ok', value: lower }
  if (RGB_COLOR_RE.test(trimmed) || HSL_COLOR_RE.test(trimmed)) {
    return { status: 'ok', value: trimmed.replace(/\s+/g, ' ') }
  }
  if (CSS_NAMED_COLORS.has(lower)) return { status: 'ok', value: lower }
  return { status: 'invalid' }
}

/**
 * Accept safe CSS colors for section styles (hex + transparent).
 * Rejects free-form strings to avoid style injection via layout JSON.
 */
export function sanitizeCssColor(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  if (trimmed.toLowerCase() === 'transparent') return 'transparent'
  if (HEX_COLOR_RE.test(trimmed)) return trimmed.toLowerCase()
  return undefined
}

const CSS_GRADIENT_RE =
  /^(linear|radial|conic)-gradient\(\s*[\s\S]{1,512}\)$/i

/** Solid color, or CSS gradient when `allowGradient` is true. */
export function sanitizeCssColorOrGradient(
  raw: unknown,
  allowGradient = false,
): string | undefined {
  const solid = sanitizeCssColor(raw)
  if (solid) return solid
  if (!allowGradient || typeof raw !== 'string') return undefined
  const trimmed = raw.trim().replace(/\s+/g, ' ')
  if (!trimmed || trimmed.length > 512) return undefined
  if (!CSS_GRADIENT_RE.test(trimmed)) return undefined
  // Reject url()/expression/etc inside gradient payloads.
  if (/url\s*\(|expression\s*\(|@import|<\/?[a-z]/i.test(trimmed)) return undefined
  return trimmed
}

/** Allow http(s), root-relative, and data:image URLs for section backgrounds. */
export function sanitizeBackgroundImageUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  if (trimmed.length > 2048) return undefined
  if (/[\r\n"'<>]/.test(trimmed)) return undefined
  if (/^(https?:\/\/|\/|data:image\/)/i.test(trimmed)) return trimmed
  return undefined
}

export function asBackgroundOverlay(raw: unknown): 'enabled' | 'disabled' | undefined {
  if (raw === 'enabled' || raw === 'disabled') return raw
  if (raw === true || raw === 'true' || raw === '1' || raw === 'on') return 'enabled'
  if (raw === false || raw === 'false' || raw === '0' || raw === 'off') return 'disabled'
  return undefined
}

function asBoolFlag(raw: unknown): boolean | undefined {
  if (raw === true || raw === 'true' || raw === '1' || raw === 'on') return true
  if (raw === false || raw === 'false' || raw === '0' || raw === 'off') return false
  return undefined
}

export function normalizeLayoutSectionStyles(raw: unknown): LayoutSectionStyles | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const src = raw as Partial<LayoutSectionStyles> & Record<string, unknown>
  const allowGradientBackground = asBoolFlag(src.allowGradientBackground) === true
  const allowGradientOverlay = asBoolFlag(src.allowGradientOverlay) === true
  const backgroundColor = sanitizeCssColorOrGradient(src.backgroundColor, allowGradientBackground)
  const textColor = sanitizeCssColor(src.textColor)
  const backgroundImage = sanitizeBackgroundImageUrl(src.backgroundImage)
  const backgroundOverlay = asBackgroundOverlay(src.backgroundOverlay)
  const overlayColor = sanitizeCssColorOrGradient(src.overlayColor, allowGradientOverlay)

  const out: LayoutSectionStyles = {
    ...(backgroundColor ? { backgroundColor } : {}),
    ...(textColor ? { textColor } : {}),
    ...(backgroundImage ? { backgroundImage } : {}),
    ...(backgroundOverlay ? { backgroundOverlay } : {}),
    ...(overlayColor ? { overlayColor } : {}),
    ...(allowGradientBackground ? { allowGradientBackground: true } : {}),
    ...(allowGradientOverlay ? { allowGradientOverlay: true } : {}),
  }
  return Object.keys(out).length > 0 ? out : undefined
}

function isCssGradient(value: string | undefined): boolean {
  return Boolean(value && CSS_GRADIENT_RE.test(value))
}

/** True when section styles need a public overlay / image paint layer. */
export function sectionStylesNeedPaintLayer(styles?: LayoutSectionStyles | null): boolean {
  const normalized = normalizeLayoutSectionStyles(styles ?? undefined)
  if (!normalized) return false
  if (normalized.backgroundImage) return true
  if (normalized.backgroundOverlay === 'enabled') return true
  if (normalized.backgroundColor && isCssGradient(normalized.backgroundColor)) return true
  return false
}

/** Inline public styles for a section (layer 2 — outline Layout Styles). */
export function buildSectionInlineStyle(
  styles?: LayoutSectionStyles | null,
): CSSProperties | undefined {
  const normalized = normalizeLayoutSectionStyles(styles ?? undefined)
  if (!normalized) return undefined

  const out: CSSProperties & Record<string, string> = {}
  const bg = normalized.backgroundColor
  if (bg) {
    if (isCssGradient(bg)) {
      out['--sf-section-bg'] = bg
      out['--sf-section-bg-image'] = bg
    } else {
      out.backgroundColor = bg
      out['--sf-section-bg'] = bg
    }
  }
  if (normalized.textColor) {
    out.color = normalized.textColor
    out['--sf-section-text'] = normalized.textColor
  }
  if (normalized.backgroundImage) {
    const url = `url(${JSON.stringify(normalized.backgroundImage)})`
    const existing = out['--sf-section-bg-image']
    out['--sf-section-bg-image'] = existing ? `${existing}, ${url}` : url
    out.backgroundImage = out['--sf-section-bg-image']
    out.backgroundSize = 'cover'
    out.backgroundPosition = 'center'
    out.backgroundRepeat = 'no-repeat'
  } else if (bg && isCssGradient(bg)) {
    out.backgroundImage = bg
  }
  if (normalized.backgroundOverlay === 'enabled') {
    out['--sf-section-overlay'] = normalized.overlayColor || 'rgba(0,0,0,0.35)'
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/** Expand 3/4-digit hex to 6-digit for `<input type="color">`. */
export function cssColorToColorInputValue(raw: string | undefined | null): string {
  const parsed = parseCssColorInput(raw)
  const color =
    parsed.status === 'ok' && HEX_COLOR_RE.test(parsed.value)
      ? parsed.value
      : sanitizeCssColor(raw)
  if (!color || color === 'transparent') return '#ffffff'
  if (color.length === 4) {
    const r = color[1]
    const g = color[2]
    const b = color[3]
    return `#${r}${r}${g}${g}${b}${b}`
  }
  if (color.length === 5) {
    const r = color[1]
    const g = color[2]
    const b = color[3]
    return `#${r}${r}${g}${g}${b}${b}`
  }
  if (color.length === 9) return color.slice(0, 7)
  return color
}

/**
 * CSS custom properties + mobile-menu media query for one outline shell.
 * Media queries cannot use custom properties, so the mobile-menu rule is inlined.
 */
export function buildOutlineBreakpointCss(
  layoutId: string,
  breakpoints: LayoutBreakpoints = DEFAULT_LAYOUT_BREAKPOINTS,
): string {
  const id = layoutId.replace(/[^a-zA-Z0-9_-]/g, '') || 'default'
  const bp = normalizeLayoutBreakpoints(breakpoints)
  const sel = `.public-shell[data-sf-layout-id="${id}"]`
  return [
    `${sel}{`,
    `--sf-bp-large-desktop:${bp.largeDesktop};`,
    `--sf-bp-desktop:${bp.desktop};`,
    `--sf-bp-tablet:${bp.tablet};`,
    `--sf-bp-mobile:${bp.mobile};`,
    `--sf-bp-mobile-menu:${bp.mobileMenu};`,
    `--sf-container-max:${bp.largeDesktop};`,
    `}`,
    `@media (max-width:${bp.mobileMenu}){`,
    `${sel}[data-sf-mobile-menu="collapse"] .site-nav,`,
    `${sel} .sf-menu[data-sf-mobile-menu="collapse"] .site-nav{`,
    `flex-direction:column;`,
    `align-items:stretch;`,
    `gap:0.35rem;`,
    `}`,
    `}`,
  ].join('')
}
