import {
  ACL_ADMIN_RESOURCE_KEYS,
  type AccessViewer,
  type AclAdminResourceKey,
} from './types'

/**
 * Pure ACL decision helpers (no DB / session).
 * Session-bound wrappers live in `access.ts`.
 */

/** Whether a viewer may use a single admin-area resource given a resolved group grant. */
export function decideAdminResourceAccess(input: {
  isAppAdmin: boolean
  isRegistered: boolean
  groupAllows: boolean
}): boolean {
  if (input.isAppAdmin) return true
  if (!input.isRegistered) return false
  return input.groupAllows
}

/** Whether a signed-in non-admin may enter the Core admin shell (any matrix grant). */
export function decideAdminShellAccess(input: {
  isAppAdmin: boolean
  isRegistered: boolean
  hasAnyAdminGrant: boolean
}): boolean {
  if (input.isAppAdmin) return true
  if (!input.isRegistered) return false
  return input.hasAnyAdminGrant
}

export type AdminAreaGate =
  | { type: 'shell' }
  | { type: 'resource'; key: AclAdminResourceKey }
  | { type: 'app-admin' }

function normalizeAdminPath(pathname: string): string {
  const raw = pathname.split('?')[0]?.split('#')[0] || '/'
  if (raw.length > 1 && raw.endsWith('/')) return raw.slice(0, -1)
  return raw || '/'
}

/**
 * Map a Core admin pathname to an ACL gate.
 * Unknown / ungated admin paths stay app-admin-only (fail closed for Managers).
 */
export function adminAreaGateForPath(pathname: string): AdminAreaGate {
  const path = normalizeAdminPath(pathname)

  if (path === '/app/admin') return { type: 'shell' }

  if (path === '/app/admin/site-chrome/environment') {
    return { type: 'resource', key: 'admin.environment' }
  }
  if (path === '/app/admin/site-chrome' || path.startsWith('/app/admin/site-chrome/')) {
    return { type: 'resource', key: 'admin.site-chrome' }
  }
  if (path === '/app/admin/settings' || path.startsWith('/app/admin/settings/')) {
    return { type: 'resource', key: 'admin.settings' }
  }
  if (path === '/app/admin/nav' || path.startsWith('/app/admin/nav/')) {
    return { type: 'resource', key: 'admin.nav' }
  }
  if (path === '/app/admin/forms' || path.startsWith('/app/admin/forms/')) {
    return { type: 'resource', key: 'admin.forms' }
  }
  if (path === '/app/admin/redirects' || path.startsWith('/app/admin/redirects/')) {
    return { type: 'resource', key: 'admin.redirects' }
  }
  if (path === '/app/admin/users/groups' || path.startsWith('/app/admin/users/groups/')) {
    return { type: 'resource', key: 'admin.groups' }
  }
  if (path === '/app/admin/users' || path.startsWith('/app/admin/users/')) {
    return { type: 'resource', key: 'admin.users' }
  }
  if (path === '/app/admin/page-settings' || path.startsWith('/app/admin/page-settings/')) {
    return { type: 'resource', key: 'admin.page-settings' }
  }
  if (
    path === '/app/admin/layouts' ||
    path.startsWith('/app/admin/layouts/') ||
    path === '/app/admin/breakpoints' ||
    path.startsWith('/app/admin/breakpoints/') ||
    path === '/app/admin/outlines' ||
    path.startsWith('/app/admin/outlines/') ||
    path === '/app/admin/particle-defaults' ||
    path.startsWith('/app/admin/particle-defaults/')
  ) {
    return { type: 'resource', key: 'admin.layouts' }
  }
  if (path === '/app/admin/cms' || path.startsWith('/app/admin/cms/')) {
    return { type: 'resource', key: 'admin.cms' }
  }
  if (path === '/app/admin/media' || path.startsWith('/app/admin/media/')) {
    return { type: 'app-admin' }
  }

  return { type: 'app-admin' }
}

/** ACL resource(s) that unlock a sidebar href for non–app-admins. Empty = app-admin only. */
export function adminResourcesForHref(href: string): AclAdminResourceKey[] {
  const gate = adminAreaGateForPath(href)
  if (gate.type === 'resource') return [gate.key]
  return []
}

/** Whether a sidebar link is visible under the current ACL grants. */
export function adminHrefAllowed(
  href: string,
  isAppAdmin: boolean,
  allowed: ReadonlySet<AclAdminResourceKey>,
): boolean {
  if (isAppAdmin) return true
  const keys = adminResourcesForHref(href)
  if (keys.length === 0) return false
  return keys.some((k) => allowed.has(k))
}

const LANDING_ORDER: { key: AclAdminResourceKey; href: string }[] = [
  { key: 'admin.users', href: '/app/admin/users' },
  { key: 'admin.nav', href: '/app/admin/nav' },
  { key: 'admin.layouts', href: '/app/admin/layouts' },
  { key: 'admin.forms', href: '/app/admin/forms' },
  { key: 'admin.page-settings', href: '/app/admin/page-settings' },
  { key: 'admin.settings', href: '/app/admin/settings' },
  { key: 'admin.site-chrome', href: '/app/admin/site-chrome' },
  { key: 'admin.redirects', href: '/app/admin/redirects' },
  { key: 'admin.groups', href: '/app/admin/users/groups' },
  { key: 'admin.cms', href: '/app/admin/cms' },
  { key: 'admin.environment', href: '/app/admin/site-chrome/environment' },
]

/** First Core admin landing path for this viewer (app admins → Users). */
export function firstAdminLandingPath(input: {
  isAppAdmin: boolean
  allowed: ReadonlySet<AclAdminResourceKey>
}): string {
  if (input.isAppAdmin) return '/app/admin/users'
  for (const entry of LANDING_ORDER) {
    if (input.allowed.has(entry.key)) return entry.href
  }
  return '/app/admin/nav'
}

export function viewerAllowsGate(
  viewer: Pick<AccessViewer, 'isAppAdmin' | 'isRegistered'>,
  gate: AdminAreaGate,
  allowed: ReadonlySet<AclAdminResourceKey>,
): boolean {
  if (viewer.isAppAdmin) return true
  if (!viewer.isRegistered) return false
  if (gate.type === 'shell') return allowed.size > 0
  if (gate.type === 'app-admin') return false
  return allowed.has(gate.key)
}

/** True when `key` is a known matrix resource (for tests / callers). */
export function isKnownAdminResourceKey(key: string): key is AclAdminResourceKey {
  return (ACL_ADMIN_RESOURCE_KEYS as readonly string[]).includes(key)
}
