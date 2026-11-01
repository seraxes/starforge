/**
 * Outline-scoped layout styles (SF-34).
 * Breakpoints live on the layout document (`styles.breakpoints`), not a
 * separate Gantry-style Styles mega-page. Defaults match Helium / Gantry rem presets.
 */

export type LayoutContainerMode = 'full' | 'boxed'

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

export type LayoutOutlineStyles = {
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

export function normalizeLayoutOutlineStyles(raw: unknown): LayoutOutlineStyles | undefined {
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
