/**
 * Persist the Layouts toolbar working outline per skin across admin menu changes.
 * URL `?outline=` still wins when present; otherwise the cookie is restored.
 */

export const ADMIN_WORKING_OUTLINE_COOKIE_MAX_AGE = 60 * 60 * 24 * 400

/** Parse `?outline=` — empty when missing (caller restores sticky cookie). */
export function pickOutlineSearchParam(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

/** Cookie name for the last outline selected under a skin. */
export function adminWorkingOutlineCookieName(skinId: string): string {
  const safe = skinId.trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'skin'
  return `sf_admin_outline_${safe}`
}

/** Client: remember outline so left-nav / menu hops keep the same working outline. */
export function rememberAdminWorkingOutline(skinId: string, outlineId: string): void {
  if (typeof document === 'undefined') return
  const skin = skinId.trim()
  const outline = outlineId.trim()
  if (!skin || !outline) return
  const name = adminWorkingOutlineCookieName(skin)
  document.cookie = `${name}=${encodeURIComponent(outline)}; Path=/; Max-Age=${ADMIN_WORKING_OUTLINE_COOKIE_MAX_AGE}; SameSite=Lax`
}
