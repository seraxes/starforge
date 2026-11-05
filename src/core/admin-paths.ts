/**
 * Canonical admin URL bases (Starforge Core vs Payload CMS).
 *
 * Core UI lives at `/admin` (Dashboard at the root).
 * Payload UI lives at `/cms/admin` (and `/cms/admin/...` collection routes).
 * Legacy `/app/admin/*` bookmarks redirect to `/admin/*` (see next.config).
 */

/** Starforge Core admin shell (Dashboard = this path). */
export const CORE_ADMIN_BASE = '/admin'

/** @deprecated Prefer CORE_ADMIN_BASE — alias kept for Dashboard D0 callers. */
export const CORE_ADMIN_ROOT = CORE_ADMIN_BASE

/** Payload CMS admin panel root. */
export const PAYLOAD_ADMIN_BASE = '/cms/admin'

/** @deprecated Prefer PAYLOAD_ADMIN_BASE — alias kept for Dashboard D0 callers. */
export const PAYLOAD_ADMIN_ROOT = PAYLOAD_ADMIN_BASE

/** Prefix for any Payload admin URL (panel + deep links). */
export const PAYLOAD_ADMIN_PREFIX = '/cms'

export function coreAdminPath(subpath = ''): string {
  if (!subpath || subpath === '/') return CORE_ADMIN_BASE
  const clean = subpath.startsWith('/') ? subpath : `/${subpath}`
  return `${CORE_ADMIN_BASE}${clean}`
}

export function payloadAdminPath(subpath = ''): string {
  if (!subpath || subpath === '/') return PAYLOAD_ADMIN_BASE
  const clean = subpath.startsWith('/') ? subpath : `/${subpath}`
  return `${PAYLOAD_ADMIN_BASE}${clean}`
}

/** True when pathname is Payload admin UI (not Core `/admin`). */
export function isPayloadAdminPath(pathname: string): boolean {
  return (
    pathname === PAYLOAD_ADMIN_BASE ||
    pathname.startsWith(`${PAYLOAD_ADMIN_BASE}/`)
  )
}

/** True when pathname is Core admin UI. */
export function isCoreAdminPath(pathname: string): boolean {
  if (isPayloadAdminPath(pathname)) return false
  return pathname === CORE_ADMIN_BASE || pathname.startsWith(`${CORE_ADMIN_BASE}/`)
}

/** True when pathname is exactly the Core Dashboard root. */
export function isCoreDashboardPath(pathname: string): boolean {
  const raw = pathname.split('?')[0]?.split('#')[0] || '/'
  const path = raw.length > 1 && raw.endsWith('/') ? raw.slice(0, -1) : raw
  return path === CORE_ADMIN_BASE
}
