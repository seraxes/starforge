/**
 * Shared Core + Payload admin sidebar header chrome (compact brand + account).
 */

/** Former content-header title + lede — lives on the STARFORGE logo tooltip. */
export const ADMIN_SHELL_LOGO_TOOLTIP =
  'Starforge admin — Top-level areas: Chrome, Settings (Modules · Admin UX · Auth · Security · Performance), Navigation, Forms, Email, Redirects, Users (Accounts · Groups · ACL), Media (Library · Settings), Layouts, CMS (Payload). Pages live under CMS → Pages; media library under Media → Library.'

/** Core admin Dashboard home (canonical — not Payload `/cms/admin`). */
export const ADMIN_DASHBOARD_HREF = '/admin'

/** Payload CMS dashboard home. */
export const PAYLOAD_DASHBOARD_HREF = '/cms/admin'

/** Logged-in account settings (Better Auth session — not Payload password). */
export const ADMIN_ACCOUNT_HREF = '/account/security'

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
