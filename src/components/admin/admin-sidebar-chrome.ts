/**
 * Shared Core + Payload admin sidebar header chrome (compact brand + account).
 */

/** Former content-header title + lede — lives on the STARFORGE logo tooltip. */
export const ADMIN_SHELL_LOGO_TOOLTIP =
  'Starforge admin — Dashboard (/admin) is home. Top-level areas: Dashboard, Chrome, Localization, Navigation, Layouts, CMS (Payload at /cms/admin), Media (Library · Settings), Forms, Email, Events, TacMap, Redirects, PWA, Users (Accounts · Groups · ACL · Profile settings), Settings (Modules · Admin UX · Auth · Security · Performance). Pages live under CMS → Pages; media library under Media → Library.'

/** Core admin Dashboard home (canonical — not Payload `/cms/admin`). */
export const ADMIN_DASHBOARD_HREF = '/admin'

/** Payload CMS dashboard home. */
export const PAYLOAD_DASHBOARD_HREF = '/cms/admin'

/** Public site home — Check site control beside the STARFORGE logo. */
export const ADMIN_CHECK_SITE_HREF = '/'

/**
 * Signed-in admin’s own Core account page (`/admin/users/:id`).
 * Not the public `/account/security` member surface.
 */
export function adminAccountHref(userId: string): string {
  return `/admin/users/${encodeURIComponent(userId.trim())}`
}

/** Initials for avatar fallback when `user.image` is empty. */
export function adminUserInitials(
  name?: string | null,
  email?: string | null,
): string {
  const fromName = (name ?? '').trim()
  if (fromName) {
    const parts = fromName.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
      return `${parts[0]!.charAt(0)}${parts[1]!.charAt(0)}`.toUpperCase()
    }
    return fromName.slice(0, 2).toUpperCase()
  }
  const local = (email ?? '').split('@')[0]?.trim() || '?'
  return local.slice(0, 2).toUpperCase()
}
