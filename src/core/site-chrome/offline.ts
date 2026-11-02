/**
 * Site Chrome offline helpers (public HTML gate).
 * `/api/*`, `/admin`, `/app/admin`, and auth recovery pages stay reachable for ops / admins.
 */

export const SITE_OFFLINE_PATH = '/site-offline'

/** Optional Retry-After seconds on public offline 503 responses. */
export const SITE_OFFLINE_RETRY_AFTER_SECONDS = 3600

/** Paths that stay open while the site is offline (non-admin visitors). */
export function isOfflineAllowedPath(pathname: string): boolean {
  if (pathname === '/login' || pathname.startsWith('/login/')) return true
  if (pathname === '/register' || pathname.startsWith('/register/')) return true
  if (pathname === '/forgot-password' || pathname.startsWith('/forgot-password/')) return true
  if (pathname === '/forgot-username' || pathname.startsWith('/forgot-username/')) return true
  if (pathname === '/reset-password' || pathname.startsWith('/reset-password/')) return true
  if (pathname === '/two-factor' || pathname.startsWith('/two-factor/')) return true
  if (pathname === '/sign-out' || pathname.startsWith('/sign-out/')) return true
  if (pathname === SITE_OFFLINE_PATH || pathname.startsWith(`${SITE_OFFLINE_PATH}/`)) {
    return true
  }
  return false
}

/**
 * Paths that middleware should never treat as locked public HTML.
 * API/health, Payload admin, Core admin, and auth stay up for ops.
 */
export function isOfflineExemptPath(pathname: string): boolean {
  if (isOfflineAllowedPath(pathname)) return true
  if (pathname.startsWith('/api/')) return true
  if (pathname.startsWith('/admin')) return true
  if (pathname.startsWith('/app/')) return true
  if (pathname.startsWith('/_next/')) return true
  return false
}
