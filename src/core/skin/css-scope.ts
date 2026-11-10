/**
 * Public body class contract for the Skin module CSS engine.
 * Hierarchy: body.sf-skin-{id} → body.sf-skin-{id}.sf-outline-{id} (outline wins).
 */

/** CSS-safe token for skin/outline body classes (same allowlist as outline style ids). */
export function sanitizeCssScopeId(raw: string | null | undefined, fallback = 'default'): string {
  const cleaned = typeof raw === 'string' ? raw.replace(/[^a-zA-Z0-9_-]/g, '') : ''
  return cleaned || fallback
}

/** Unique body class for the active skin — e.g. `sf-skin-starforge-pastel`. */
export function skinBodyClass(skinId: string | null | undefined): string {
  return `sf-skin-${sanitizeCssScopeId(skinId, 'default')}`
}

/** Unique body class for the active outline — e.g. `sf-outline-starforge-pastel-test`. */
export function outlineBodyClass(outlineId: string | null | undefined): string {
  return `sf-outline-${sanitizeCssScopeId(outlineId, 'default')}`
}

/**
 * Compound selector: outline layer always beats skin-only rules for the same vars.
 * `body.sf-skin-X.sf-outline-Y`
 */
export function skinOutlineBodySelector(
  skinId: string | null | undefined,
  outlineId: string | null | undefined,
): string {
  return `body.${skinBodyClass(skinId)}.${outlineBodyClass(outlineId)}`
}

/** Skin-only body selector — `body.sf-skin-X`. */
export function skinBodySelector(skinId: string | null | undefined): string {
  return `body.${skinBodyClass(skinId)}`
}
