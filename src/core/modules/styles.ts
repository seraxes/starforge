/**
 * Outline-scoped layout styles (SF-34 / SF-64).
 *
 * CSS ownership (keep layers separate — do not mix into admin chrome):
 * 1) Design tokens — platform `:root` + Skin `body.sf-skin-{id}`
 * 2) Outline Layout Styles — `body.sf-skin-*.sf-outline-*` breakpoints +
 *    page (body) background + type (title/text fonts and colors, accent/link
 *    and hover) + section full/boxed + section bg/text/image/overlay
 *    + section padding/margin (cog four-side px|rem → CSS shorthand)
 * 3) Custom CSS — Page Settings / Custom particle (not admin chrome)
 *
 * Section Styles live on each live section instance (`section.styles`) — listing
 * under Layouts → Styles mirrors the outline canvas; deleting a section drops
 * its styles with it. Breakpoints, page background, and type stay on
 * `document.styles`.
 */

import type { CSSProperties } from 'react'

import {
  outlineBodyClass,
  sanitizeCssScopeId,
  skinOutlineBodySelector,
} from '@/core/skin/css-scope'

export type LayoutContainerMode = 'full' | 'boxed'

/**
 * Gantry-like Section Styles on a layout section instance (not a fixed name list).
 * Live sections only — no Navigation/Header preset name map.
 */
/** Unit for section padding / margin box inputs (cog). */
export type LayoutBoxSpacingUnit = 'px' | 'rem'

/**
 * Four-side spacing draft for admin inputs (top / right / bottom / left).
 * Empty side strings mean “0” when any side is set; all empty clears the property.
 */
export type LayoutBoxSpacingDraft = {
  top: string
  right: string
  bottom: string
  left: string
  unit: LayoutBoxSpacingUnit
}

export type LayoutSectionStyles = {
  /** Hex / transparent fill, or CSS gradient when allowGradientBackground. */
  backgroundColor?: string
  /** Hex text / foreground color (inherits into section content). */
  textColor?: string
  /** Payload Media id for section background (SF-66 primary). */
  backgroundMediaId?: string
  /** Background image URL (http(s), /, or data:) — fallback when no media id. */
  backgroundImage?: string
  /** Gantry-style Background Overlay toggle. */
  backgroundOverlay?: 'enabled' | 'disabled'
  /** Overlay fill (hex / transparent, or gradient when allowGradientOverlay). */
  overlayColor?: string
  /** Permit CSS gradient syntax in backgroundColor. */
  allowGradientBackground?: boolean
  /** Permit CSS gradient syntax in overlayColor. */
  allowGradientOverlay?: boolean
  /**
   * CSS padding shorthand from the section cog (four lengths, px|rem).
   * Example: `1rem 1.5rem 1rem 1.5rem`.
   */
  padding?: string
  /**
   * CSS margin shorthand from the section cog (four lengths, px|rem; negatives OK).
   * Example: `0 0 2rem 0`.
   */
  margin?: string
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

/** How a page background image is fitted on the body. */
export type LayoutBodyBackgroundFit = 'cover-fixed' | 'cover-scroll' | 'contain' | 'tile'

/**
 * Outline page background — paints on `body` behind every section that does
 * not set its own fill. `disabled` blocks an inherited parent background.
 */
export type LayoutBodyBackground = {
  disabled?: boolean
  /** Hex / transparent, or a CSS gradient when allowGradientBackground. */
  backgroundColor?: string
  /** Permit CSS gradient syntax in backgroundColor. */
  allowGradientBackground?: boolean
  /** Payload Media id (primary). */
  backgroundMediaId?: string
  /** URL fallback when no media id, or the resolved public URL at paint time. */
  backgroundImage?: string
  backgroundSize?: 'cover' | 'contain'
  backgroundAttachment?: 'scroll' | 'fixed'
  backgroundRepeat?: 'no-repeat' | 'repeat'
  /** Paint a layer over the page background image (and gradient fill). */
  backgroundOverlay?: 'enabled' | 'disabled'
  /** Overlay fill: hex / transparent, or a gradient when allowGradientOverlay. */
  overlayColor?: string
  /** Permit CSS gradient syntax in overlayColor. */
  allowGradientOverlay?: boolean
}

/**
 * Outline type: title and body fonts/colors, plus accent (hyperlinks) and hover.
 * Font ids come from `LAYOUT_FONT_CHOICES` (system stacks, no remote font files).
 * `disabled` blocks an inherited parent type block.
 */
export type LayoutTypography = {
  disabled?: boolean
  /** Catalog id (`LAYOUT_FONT_CHOICES`). Empty omits the override. */
  titleFont?: string
  textFont?: string
  titleColor?: string
  textColor?: string
  /** Hyperlink and `--sf-accent` color. */
  linkColor?: string
  /** Hyperlink hover and `--sf-accent-hover`. */
  linkHoverColor?: string
}

/** Outline document `styles` bag (breakpoints, page background, type). */
export type LayoutDocumentStyles = {
  breakpoints?: LayoutBreakpoints
  body?: LayoutBodyBackground
  typography?: LayoutTypography
}

/** System font stacks for Layouts → Styles → Type. Ids are what we persist. */
export const LAYOUT_FONT_CHOICES = [
  { id: 'system-sans', label: 'System sans', stack: "system-ui, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif" },
  { id: 'segoe', label: 'Segoe UI', stack: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif" },
  { id: 'arial', label: 'Arial', stack: "Arial, 'Helvetica Neue', sans-serif" },
  { id: 'verdana', label: 'Verdana', stack: "Verdana, Geneva, sans-serif" },
  { id: 'trebuchet', label: 'Trebuchet MS', stack: "'Trebuchet MS', 'Segoe UI', sans-serif" },
  { id: 'tahoma', label: 'Tahoma', stack: "Tahoma, Verdana, sans-serif" },
  { id: 'calibri', label: 'Calibri', stack: "Calibri, 'Segoe UI', sans-serif" },
  { id: 'candara', label: 'Candara', stack: "Candara, 'Segoe UI', sans-serif" },
  { id: 'century-gothic', label: 'Century Gothic', stack: "'Century Gothic', 'Trebuchet MS', sans-serif" },
  { id: 'georgia', label: 'Georgia', stack: "Georgia, 'Times New Roman', serif" },
  { id: 'palatino', label: 'Palatino', stack: "Palatino, 'Palatino Linotype', 'Book Antiqua', serif" },
  { id: 'times', label: 'Times New Roman', stack: "'Times New Roman', Times, serif" },
  { id: 'cambria', label: 'Cambria', stack: "Cambria, Georgia, serif" },
  { id: 'garamond', label: 'Garamond', stack: "Garamond, 'Palatino Linotype', serif" },
  { id: 'constantia', label: 'Constantia', stack: "Constantia, Georgia, serif" },
  { id: 'courier', label: 'Courier New', stack: "'Courier New', Courier, monospace" },
  { id: 'consolas', label: 'Consolas', stack: "Consolas, 'Courier New', monospace" },
  { id: 'impact', label: 'Impact', stack: "Impact, 'Arial Narrow', sans-serif" },
] as const

export type LayoutFontId = (typeof LAYOUT_FONT_CHOICES)[number]['id']

const LAYOUT_FONT_BY_ID = new Map<string, (typeof LAYOUT_FONT_CHOICES)[number]>(
  LAYOUT_FONT_CHOICES.map((font) => [font.id, font]),
)

/** Catalog id → CSS font stack. Unknown ids return undefined. */
export function layoutFontStack(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  return LAYOUT_FONT_BY_ID.get(raw.trim())?.stack
}

export function sanitizeLayoutFontId(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const id = raw.trim()
  if (!id || !LAYOUT_FONT_BY_ID.has(id)) return undefined
  return id
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
/** Section padding/margin sides — numbers with px or rem only. */
const BOX_SIDE_LENGTH_RE = /^-?\d+(\.\d+)?(px|rem)$/i
const BOX_SIDE_NUMBER_RE = /^-?\d+(\.\d+)?$/
const BOX_SPACING_MAX = 9999

/** Accept rem/em/px/% lengths; reject empty / unsafe strings. */
export function sanitizeCssLength(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback
  const trimmed = raw.trim().toLowerCase()
  if (!LENGTH_RE.test(trimmed)) return fallback
  return trimmed
}

export function asBoxSpacingUnit(raw: unknown): LayoutBoxSpacingUnit {
  return raw === 'px' ? 'px' : 'rem'
}

function clampBoxSideNumber(n: number, allowNegative: boolean): number | undefined {
  if (!Number.isFinite(n)) return undefined
  if (!allowNegative && n < 0) return undefined
  if (n < -BOX_SPACING_MAX || n > BOX_SPACING_MAX) return undefined
  // Drop noisy float noise from number inputs.
  const rounded = Math.round(n * 1000) / 1000
  return Object.is(rounded, -0) ? 0 : rounded
}

/**
 * Build a safe CSS box shorthand from four number inputs + unit.
 * All-empty → undefined (clear). Missing sides become 0 when any side is set.
 */
export function formatLayoutBoxSpacing(
  draft: LayoutBoxSpacingDraft,
  options?: { allowNegative?: boolean },
): string | undefined {
  const allowNegative = options?.allowNegative === true
  const unit = asBoxSpacingUnit(draft.unit)
  const rawSides = [draft.top, draft.right, draft.bottom, draft.left].map((s) =>
    typeof s === 'string' ? s.trim() : '',
  )
  if (rawSides.every((s) => !s)) return undefined

  const lengths: string[] = []
  for (const side of rawSides) {
    if (!side) {
      lengths.push(`0${unit}`)
      continue
    }
    if (!BOX_SIDE_NUMBER_RE.test(side)) return undefined
    const n = clampBoxSideNumber(Number(side), allowNegative)
    if (n === undefined) return undefined
    lengths.push(`${n}${unit}`)
  }
  return lengths.join(' ')
}

/** Parse a stored shorthand back into cog inputs (defaults unit to rem). */
export function parseLayoutBoxSpacing(
  raw: string | undefined | null,
  fallbackUnit: LayoutBoxSpacingUnit = 'rem',
): LayoutBoxSpacingDraft {
  const empty: LayoutBoxSpacingDraft = {
    top: '',
    right: '',
    bottom: '',
    left: '',
    unit: fallbackUnit,
  }
  if (typeof raw !== 'string') return empty
  const parts = raw.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return empty
  if (parts.length > 4) return empty
  if (!parts.every((p) => BOX_SIDE_LENGTH_RE.test(p))) return empty

  const unitMatch = parts[0].match(/(px|rem)$/i)
  const unit = asBoxSpacingUnit(unitMatch?.[1]?.toLowerCase() ?? fallbackUnit)
  if (!parts.every((p) => p.toLowerCase().endsWith(unit))) return empty

  const nums = parts.map((p) => p.slice(0, -unit.length))
  // Expand CSS shorthand: 1 → all; 2 → vertical/horizontal; 3 → top / x / bottom; 4 → TRBL.
  const top = nums[0]
  let right = nums[0]
  let bottom = nums[0]
  let left = nums[0]
  if (nums.length === 2) {
    right = nums[1]
    left = nums[1]
  } else if (nums.length === 3) {
    right = nums[1]
    left = nums[1]
    bottom = nums[2]
  } else if (nums.length === 4) {
    right = nums[1]
    bottom = nums[2]
    left = nums[3]
  }
  return { top, right, bottom, left, unit }
}

/**
 * Accept a CSS padding/margin shorthand of 1–4 px|rem lengths.
 * Rejects mixed units, other units, and (for padding) negatives.
 */
export function sanitizeCssBoxShorthand(
  raw: unknown,
  options?: { allowNegative?: boolean },
): string | undefined {
  if (typeof raw !== 'string') return undefined
  const trimmed = raw.trim().toLowerCase().replace(/\s+/g, ' ')
  if (!trimmed) return undefined
  if (trimmed.length > 64) return undefined
  const parts = trimmed.split(' ')
  if (parts.length < 1 || parts.length > 4) return undefined
  if (!parts.every((p) => BOX_SIDE_LENGTH_RE.test(p))) return undefined

  const unit = parts[0].endsWith('px') ? 'px' : 'rem'
  if (!parts.every((p) => p.endsWith(unit))) return undefined

  const allowNegative = options?.allowNegative === true
  const normalized: string[] = []
  for (const part of parts) {
    const n = clampBoxSideNumber(Number(part.slice(0, -unit.length)), allowNegative)
    if (n === undefined) return undefined
    normalized.push(`${n}${unit}`)
  }
  return normalized.join(' ')
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

export function bodyBackgroundFit(
  body: LayoutBodyBackground | null | undefined,
): LayoutBodyBackgroundFit {
  if (body?.backgroundRepeat === 'repeat') return 'tile'
  if (body?.backgroundSize === 'contain') return 'contain'
  if (body?.backgroundAttachment === 'scroll') return 'cover-scroll'
  return 'cover-fixed'
}

export function layoutBodyBackgroundFromFit(
  fit: LayoutBodyBackgroundFit,
): Pick<LayoutBodyBackground, 'backgroundSize' | 'backgroundAttachment' | 'backgroundRepeat'> {
  if (fit === 'tile') {
    return { backgroundSize: 'cover', backgroundAttachment: 'scroll', backgroundRepeat: 'repeat' }
  }
  if (fit === 'contain') {
    return { backgroundSize: 'contain', backgroundAttachment: 'fixed', backgroundRepeat: 'no-repeat' }
  }
  if (fit === 'cover-scroll') {
    return { backgroundSize: 'cover', backgroundAttachment: 'scroll', backgroundRepeat: 'no-repeat' }
  }
  return { backgroundSize: 'cover', backgroundAttachment: 'fixed', backgroundRepeat: 'no-repeat' }
}

export function normalizeLayoutBodyBackground(raw: unknown): LayoutBodyBackground | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const src = raw as Partial<LayoutBodyBackground>
  const disabled = asBoolFlag(src.disabled) === true
  const allowGradientBackground = asBoolFlag(src.allowGradientBackground) === true
  const allowGradientOverlay = asBoolFlag(src.allowGradientOverlay) === true
  const backgroundColor = sanitizeCssColorOrGradient(src.backgroundColor, allowGradientBackground)
  const backgroundMediaId = sanitizeBackgroundMediaId(src.backgroundMediaId)
  const backgroundImage = sanitizeBackgroundImageUrl(src.backgroundImage)
  const backgroundSize = src.backgroundSize === 'contain' ? 'contain' : src.backgroundSize === 'cover' ? 'cover' : undefined
  const backgroundAttachment =
    src.backgroundAttachment === 'scroll' || src.backgroundAttachment === 'fixed'
      ? src.backgroundAttachment
      : undefined
  const backgroundRepeat =
    src.backgroundRepeat === 'repeat' || src.backgroundRepeat === 'no-repeat'
      ? src.backgroundRepeat
      : undefined
  const overlayEnabled = asBackgroundOverlay(src.backgroundOverlay) === 'enabled'
  const overlayColor = sanitizeCssColorOrGradient(src.overlayColor, allowGradientOverlay)
  if (
    !disabled &&
    !backgroundColor &&
    !backgroundMediaId &&
    !backgroundImage &&
    !overlayEnabled &&
    !overlayColor &&
    !allowGradientBackground &&
    !allowGradientOverlay
  ) {
    return undefined
  }
  return {
    ...(disabled ? { disabled: true } : {}),
    ...(backgroundColor ? { backgroundColor } : {}),
    ...(allowGradientBackground ? { allowGradientBackground: true } : {}),
    ...(backgroundMediaId ? { backgroundMediaId } : {}),
    ...(backgroundImage ? { backgroundImage } : {}),
    ...(backgroundSize ? { backgroundSize } : {}),
    ...(backgroundAttachment ? { backgroundAttachment } : {}),
    ...(backgroundRepeat ? { backgroundRepeat } : {}),
    ...(overlayEnabled ? { backgroundOverlay: 'enabled' as const } : {}),
    ...(overlayColor ? { overlayColor } : {}),
    ...(allowGradientOverlay ? { allowGradientOverlay: true } : {}),
  }
}

export function normalizeLayoutTypography(raw: unknown): LayoutTypography | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const src = raw as Partial<LayoutTypography>
  const disabled = asBoolFlag(src.disabled) === true
  const titleFont = sanitizeLayoutFontId(src.titleFont)
  const textFont = sanitizeLayoutFontId(src.textFont)
  const titleColor = sanitizeCssColor(src.titleColor)
  const textColor = sanitizeCssColor(src.textColor)
  const linkColor = sanitizeCssColor(src.linkColor)
  const linkHoverColor = sanitizeCssColor(src.linkHoverColor)
  if (
    !disabled &&
    !titleFont &&
    !textFont &&
    !titleColor &&
    !textColor &&
    !linkColor &&
    !linkHoverColor
  ) {
    return undefined
  }
  return {
    ...(disabled ? { disabled: true } : {}),
    ...(titleFont ? { titleFont } : {}),
    ...(textFont ? { textFont } : {}),
    ...(titleColor ? { titleColor } : {}),
    ...(textColor ? { textColor } : {}),
    ...(linkColor ? { linkColor } : {}),
    ...(linkHoverColor ? { linkHoverColor } : {}),
  }
}

export function normalizeLayoutOutlineStyles(raw: unknown): LayoutDocumentStyles | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const src = raw as { breakpoints?: unknown; body?: unknown; typography?: unknown }
  const breakpoints =
    src.breakpoints !== undefined && src.breakpoints !== null
      ? normalizeLayoutBreakpoints(src.breakpoints)
      : undefined
  const body = normalizeLayoutBodyBackground(src.body)
  const typography = normalizeLayoutTypography(src.typography)
  if (!breakpoints && !body && !typography) return undefined
  return {
    ...(breakpoints ? { breakpoints } : {}),
    ...(body ? { body } : {}),
    ...(typography ? { typography } : {}),
  }
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

export function sanitizeBackgroundMediaId(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  if (trimmed.length > 64) return undefined
  if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) return undefined
  return trimmed
}

export function normalizeLayoutSectionStyles(raw: unknown): LayoutSectionStyles | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const src = raw as Partial<LayoutSectionStyles> & Record<string, unknown>
  const allowGradientBackground = asBoolFlag(src.allowGradientBackground) === true
  const allowGradientOverlay = asBoolFlag(src.allowGradientOverlay) === true
  const backgroundColor = sanitizeCssColorOrGradient(src.backgroundColor, allowGradientBackground)
  const textColor = sanitizeCssColor(src.textColor)
  const backgroundMediaId = sanitizeBackgroundMediaId(src.backgroundMediaId)
  const backgroundImage = sanitizeBackgroundImageUrl(src.backgroundImage)
  const backgroundOverlay = asBackgroundOverlay(src.backgroundOverlay)
  const overlayColor = sanitizeCssColorOrGradient(src.overlayColor, allowGradientOverlay)
  const padding = sanitizeCssBoxShorthand(src.padding, { allowNegative: false })
  const margin = sanitizeCssBoxShorthand(src.margin, { allowNegative: true })

  const out: LayoutSectionStyles = {
    ...(backgroundColor ? { backgroundColor } : {}),
    ...(textColor ? { textColor } : {}),
    ...(backgroundMediaId ? { backgroundMediaId } : {}),
    ...(backgroundImage ? { backgroundImage } : {}),
    ...(backgroundOverlay ? { backgroundOverlay } : {}),
    ...(overlayColor ? { overlayColor } : {}),
    ...(allowGradientBackground ? { allowGradientBackground: true } : {}),
    ...(allowGradientOverlay ? { allowGradientOverlay: true } : {}),
    ...(padding ? { padding } : {}),
    ...(margin ? { margin } : {}),
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
  if (normalized.backgroundImage || normalized.backgroundMediaId) return true
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
  if (normalized.padding) out.padding = normalized.padding
  if (normalized.margin) out.margin = normalized.margin
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
 * Outline breakpoints on the body compound selector (outline beats skin).
 * `body.sf-skin-{skin}.sf-outline-{outline}` — boxed sections read `--sf-container-max`.
 * Media queries cannot use custom properties, so the mobile-menu rule is inlined.
 */
export function buildOutlineBreakpointCss(
  layoutId: string,
  breakpoints: LayoutBreakpoints = DEFAULT_LAYOUT_BREAKPOINTS,
  skinId?: string | null,
): string {
  const outlineId = sanitizeCssScopeId(layoutId, 'default')
  const resolvedSkin =
    typeof skinId === 'string' && skinId.trim() ? skinId.trim() : 'default'
  const sel = skinOutlineBodySelector(resolvedSkin, outlineId)
  const bp = normalizeLayoutBreakpoints(breakpoints)
  const outlineClass = outlineBodyClass(outlineId)
  return [
    `${sel}{`,
    `--sf-bp-large-desktop:${bp.largeDesktop};`,
    `--sf-bp-desktop:${bp.desktop};`,
    `--sf-bp-tablet:${bp.tablet};`,
    `--sf-bp-mobile:${bp.mobile};`,
    `--sf-bp-mobile-menu:${bp.mobileMenu};`,
    /* Boxed sections use this (large-desktop breakpoint). */
    `--sf-container-max:${bp.largeDesktop};`,
    `}`,
    `@media (max-width:${bp.mobileMenu}){`,
    `body.${outlineClass}[data-sf-mobile-menu="collapse"] .site-nav,`,
    `body.${outlineClass} .public-shell[data-sf-mobile-menu="collapse"] .site-nav,`,
    `body.${outlineClass} .sf-menu[data-sf-mobile-menu="collapse"] .site-nav{`,
    `flex-direction:column;`,
    `align-items:stretch;`,
    `gap:0.35rem;`,
    `}`,
    `}`,
  ].join('')
}

/**
 * Page background on the outline body selector.
 * An image replaces the default body gradient and lets the footer stay clear
 * so the picture sits behind the whole page. Section styles still paint on top.
 */
export function buildOutlineBodyBackgroundCss(
  layoutId: string,
  skinId: string | null | undefined,
  body: LayoutBodyBackground | null | undefined,
): string {
  const normalized = normalizeLayoutBodyBackground(body)
  if (!normalized || normalized.disabled) return ''
  const image = normalized.backgroundImage
  const color = normalized.backgroundColor
  const gradient = isCssGradient(color) ? color : undefined
  const solid = color && !gradient ? color : undefined
  const overlayOn = normalized.backgroundOverlay === 'enabled'
  if (!image && !color && !overlayOn) return ''

  const outlineId = sanitizeCssScopeId(layoutId, 'default')
  const resolvedSkin =
    typeof skinId === 'string' && skinId.trim() ? skinId.trim() : 'default'
  const sel = skinOutlineBodySelector(resolvedSkin, outlineId)
  const fit = bodyBackgroundFit(normalized)
  const size = fit === 'contain' ? 'contain' : fit === 'tile' ? 'auto' : 'cover'
  const attachment = fit === 'cover-scroll' || fit === 'tile' ? 'scroll' : 'fixed'
  const repeat = fit === 'tile' ? 'repeat' : 'no-repeat'
  const rules: string[] = []
  if (solid) rules.push(`background-color:${solid};`)
  if (image && gradient) {
    rules.push(`background-image:url(${JSON.stringify(image)}),${gradient};`)
    rules.push(`background-size:${size},cover;`)
    rules.push('background-position:center center,center center;')
    rules.push(`background-repeat:${repeat},no-repeat;`)
    rules.push(`background-attachment:${attachment},${attachment};`)
  } else if (image) {
    rules.push(`background-image:url(${JSON.stringify(image)});`)
    rules.push(`background-size:${size};`)
    rules.push('background-position:center center;')
    rules.push(`background-repeat:${repeat};`)
    rules.push(`background-attachment:${attachment};`)
  } else if (gradient) {
    rules.push(`background-image:${gradient};`)
    rules.push('background-size:cover;')
    rules.push('background-position:center center;')
    rules.push('background-repeat:no-repeat;')
    rules.push('background-attachment:fixed;')
  }
  const chunks: string[] = []
  if (rules.length > 0) chunks.push(`${sel}{${rules.join('')}}`)
  if (image) chunks.push(`${sel} .site-footer{background-color:transparent;}`)
  if (overlayOn) {
    const paint = normalized.overlayColor || 'rgba(0,0,0,0.35)'
    const fixed = Boolean(image) ? attachment === 'fixed' : true
    chunks.push(`${sel}{position:relative;isolation:isolate;}`)
    chunks.push(
      `${sel}::before{content:"";position:${fixed ? 'fixed' : 'absolute'};inset:0;z-index:-1;pointer-events:none;background:${paint};}`,
    )
  }
  return chunks.join('')
}

/**
 * Title / body fonts and colors, plus accent (hyperlinks) and hover,
 * on the outline body selector. Unset fields stay on the skin tokens.
 * Section text color (`--sf-section-text`) still wins inside that section.
 */
export function buildOutlineTypographyCss(
  layoutId: string,
  skinId: string | null | undefined,
  typography: LayoutTypography | null | undefined,
): string {
  const normalized = normalizeLayoutTypography(typography)
  if (!normalized || normalized.disabled) return ''

  const outlineId = sanitizeCssScopeId(layoutId, 'default')
  const resolvedSkin =
    typeof skinId === 'string' && skinId.trim() ? skinId.trim() : 'default'
  const sel = skinOutlineBodySelector(resolvedSkin, outlineId)
  const titleStack = layoutFontStack(normalized.titleFont)
  const textStack = layoutFontStack(normalized.textFont)
  const vars: string[] = []
  if (titleStack) vars.push(`--font-display:${titleStack};`)
  if (textStack) vars.push(`--font-body:${textStack};`)
  if (normalized.titleColor) vars.push(`--sf-title-color:${normalized.titleColor};`)
  if (normalized.textColor) vars.push(`--sf-ink:${normalized.textColor};`)
  if (normalized.linkColor) {
    vars.push(`--sf-accent:${normalized.linkColor};`)
    vars.push(`--sf-link:${normalized.linkColor};`)
  }
  if (normalized.linkHoverColor) {
    vars.push(`--sf-accent-hover:${normalized.linkHoverColor};`)
    vars.push(`--sf-link-hover:${normalized.linkHoverColor};`)
  }
  if (vars.length === 0) return ''

  const rules = [`${sel}{${vars.join('')}}`]
  if (titleStack || normalized.titleColor) {
    const decls: string[] = []
    if (titleStack) decls.push('font-family:var(--font-display);')
    if (normalized.titleColor) decls.push('color:var(--sf-section-text, var(--sf-title-color));')
    rules.push(`${sel} :is(h1,h2,h3,h4,h5,h6){${decls.join('')}}`)
  }
  const linkSel = `${sel} :is(.cms-richtext,.sf-rich-content,.sf-rich-html,.sf-page-content) a:not(.button-link)`
  if (normalized.linkColor) rules.push(`${linkSel}{color:var(--sf-link);}`)
  if (normalized.linkHoverColor) rules.push(`${linkSel}:hover{color:var(--sf-link-hover);}`)
  else if (normalized.linkColor) rules.push(`${linkSel}:hover{color:var(--sf-link);}`)
  return rules.join('')
}
