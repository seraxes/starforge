/**
 * Site Chrome offline helpers (public HTML gate).
 * `/api/*`, Core `/admin`, Payload `/cms`, and auth recovery pages stay reachable for ops / admins.
 * Public auth paths may be locale-prefixed (`/en/login`) — strip via Core i18n.
 */

import { pathnameWithoutLocale } from '@/core/i18n/path'

export const SITE_OFFLINE_PATH = '/site-offline'

/** Hardcoded 404 / thrown-error recovery URL (not in Navigation). */
export const SITE_NOT_FOUND_PATH = '/site-not-found'

/** Optional Retry-After seconds on public offline 503 responses. */
export const SITE_OFFLINE_RETRY_AFTER_SECONDS = 3600

/** Paths that stay open while the site is offline (non-admin visitors). */
export function isOfflineAllowedPath(pathname: string): boolean {
  const path = pathnameWithoutLocale(pathname)
  if (path === '/login' || path.startsWith('/login/')) return true
  if (path === '/register' || path.startsWith('/register/')) return true
  if (path === '/forgot-password' || path.startsWith('/forgot-password/')) return true
  if (path === '/forgot-username' || path.startsWith('/forgot-username/')) return true
  if (path === '/reset-password' || path.startsWith('/reset-password/')) return true
  if (path === '/two-factor' || path.startsWith('/two-factor/')) return true
  // System HTML routes are never locale-prefixed.
  if (pathname === SITE_OFFLINE_PATH || pathname.startsWith(`${SITE_OFFLINE_PATH}/`)) {
    return true
  }
  if (pathname === SITE_NOT_FOUND_PATH || pathname.startsWith(`${SITE_NOT_FOUND_PATH}/`)) {
    return true
  }
  return false
}

/**
 * Paths that the Node proxy should never treat as locked public HTML.
 * API/health, Payload admin, Core admin, and auth stay up for ops.
 */
export function isOfflineExemptPath(pathname: string): boolean {
  if (isOfflineAllowedPath(pathname)) return true
  if (pathname.startsWith('/api/')) return true
  if (pathname.startsWith('/cms')) return true
  if (pathname.startsWith('/admin')) return true
  if (pathname.startsWith('/_next/')) return true
  // SEO surfaces stay reachable while the HTML site is offline.
  if (pathname === '/robots.txt') return true
  if (pathname === '/sitemap.xml' || pathname.startsWith('/sitemap')) return true
  // product:pwa — manifest + Serwist worker stay outside offline HTML rewrite.
  if (pathname === '/manifest.webmanifest') return true
  if (pathname === '/sw.js' || pathname.startsWith('/sw.js')) return true
  return false
}
