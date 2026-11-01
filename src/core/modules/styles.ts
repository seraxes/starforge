/**
 * Outline-scoped layout styles (SF-34).
 *
 * CSS ownership (keep layers separate — do not mix into admin chrome):
 * 1) Design tokens — `:root` (later Tailwind theme)
 * 2) Outline Layout Styles — section full/boxed + section bg/text + breakpoints
 * 3) Custom CSS — Page Settings / Custom particle (not admin chrome)
 *
 * Breakpoints live on the layout document (`styles.breakpoints`), not a
 * separate Gantry-style Styles mega-page. Defaults match Helium / Gantry rem presets.
 */

import type { CSSProperties } from 'react'

export type LayoutContainerMode = 'full' | 'boxed'

/**
 * Gantry-like Section Styles on a layout section instance (not a fixed name list).
 * Background image / overlay reserved for a later slice.
 */
export type LayoutSectionStyles = {
  /** Hex / transparent background fill. */
  backgroundColor?: string
  /** Hex text / foreground color (inherits into section content). */
  textColor?: string
  /** Reserved — media URL (Gantry Background Image). */
  backgroundImage?: string
  /** Reserved — Gantry Background Overlay enabled|disabled. */
  backgroundOverlay?: 'enabled' | 'disabled'
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

export function normalizeLayoutSectionStyles(raw: unknown): LayoutSectionStyles | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const src = raw as Partial<LayoutSectionStyles>
  const backgroundColor = sanitizeCssColor(src.backgroundColor)
  const textColor = sanitizeCssColor(src.textColor)
  const backgroundImage =
    typeof src.backgroundImage === 'string' && src.backgroundImage.trim()
      ? src.backgroundImage.trim().slice(0, 2048)
      : undefined
  const backgroundOverlay =
    src.backgroundOverlay === 'enabled' || src.backgroundOverlay === 'disabled'
      ? src.backgroundOverlay
      : undefined

  const out: LayoutSectionStyles = {
    ...(backgroundColor ? { backgroundColor } : {}),
    ...(textColor ? { textColor } : {}),
    ...(backgroundImage ? { backgroundImage } : {}),
    ...(backgroundOverlay ? { backgroundOverlay } : {}),
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/** Inline public styles for a section (layer 2 — outline Layout Styles). */
export function buildSectionInlineStyle(
  styles?: LayoutSectionStyles | null,
): CSSProperties | undefined {
  const normalized = normalizeLayoutSectionStyles(styles ?? undefined)
  if (!normalized) return undefined

  const out: CSSProperties & Record<string, string> = {}
  if (normalized.backgroundColor) {
    out.backgroundColor = normalized.backgroundColor
    out['--sf-section-bg'] = normalized.backgroundColor
  }
  if (normalized.textColor) {
    out.color = normalized.textColor
    out['--sf-section-text'] = normalized.textColor
  }
  // Background image / overlay intentionally not applied yet (reserved).
  return Object.keys(out).length > 0 ? out : undefined
}

/** Expand 3/4-digit hex to 6-digit for `<input type="color">`. */
export function cssColorToColorInputValue(raw: string | undefined | null): string {
  const color = sanitizeCssColor(raw)
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
