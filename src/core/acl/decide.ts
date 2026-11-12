import { CORE_ADMIN_BASE } from '@/core/admin-paths'

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

  // Dashboard root — `/admin` (legacy `/app/admin` alias still gated).
  if (path === CORE_ADMIN_BASE || path === '/app/admin') {
    return { type: 'resource', key: 'admin.dashboard' }
  }

  if (path === `${CORE_ADMIN_BASE}/site-chrome/environment`) {
    return { type: 'resource', key: 'admin.environment' }
  }
  if (path === `${CORE_ADMIN_BASE}/site-chrome` || path.startsWith(`${CORE_ADMIN_BASE}/site-chrome/`)) {
    return { type: 'resource', key: 'admin.site-chrome' }
  }
  if (
    path === `${CORE_ADMIN_BASE}/localization` ||
    path.startsWith(`${CORE_ADMIN_BASE}/localization/`)
  ) {
    return { type: 'resource', key: 'admin.localization' }
  }
  if (path === `${CORE_ADMIN_BASE}/settings` || path.startsWith(`${CORE_ADMIN_BASE}/settings/`)) {
    return { type: 'resource', key: 'admin.settings' }
  }
  if (path === `${CORE_ADMIN_BASE}/nav` || path.startsWith(`${CORE_ADMIN_BASE}/nav/`)) {
    return { type: 'resource', key: 'admin.nav' }
  }
  if (path === `${CORE_ADMIN_BASE}/forms` || path.startsWith(`${CORE_ADMIN_BASE}/forms/`)) {
    return { type: 'resource', key: 'admin.forms' }
  }
  if (path === `${CORE_ADMIN_BASE}/email` || path.startsWith(`${CORE_ADMIN_BASE}/email/`)) {
    return { type: 'resource', key: 'admin.email-manager' }
  }
  if (
    path === `${CORE_ADMIN_BASE}/payments/merchant` ||
    path.startsWith(`${CORE_ADMIN_BASE}/payments/merchant/`)
  ) {
    return { type: 'resource', key: 'admin.payments-merchant' }
  }
  if (path === `${CORE_ADMIN_BASE}/payments` || path.startsWith(`${CORE_ADMIN_BASE}/payments/`)) {
    return { type: 'resource', key: 'admin.payments' }
  }
  if (
    path === `${CORE_ADMIN_BASE}/subscriptions` ||
    path.startsWith(`${CORE_ADMIN_BASE}/subscriptions/`)
  ) {
    return { type: 'resource', key: 'admin.subscriptions' }
  }
  if (path === `${CORE_ADMIN_BASE}/events` || path.startsWith(`${CORE_ADMIN_BASE}/events/`)) {
    return { type: 'resource', key: 'admin.events' }
  }
  if (path === `${CORE_ADMIN_BASE}/profiles` || path.startsWith(`${CORE_ADMIN_BASE}/profiles/`)) {
    return { type: 'resource', key: 'admin.profiles' }
  }
  if (path === `${CORE_ADMIN_BASE}/maps` || path.startsWith(`${CORE_ADMIN_BASE}/maps/`)) {
    return { type: 'resource', key: 'admin.maps' }
  }
  if (path === `${CORE_ADMIN_BASE}/redirects` || path.startsWith(`${CORE_ADMIN_BASE}/redirects/`)) {
    return { type: 'resource', key: 'admin.redirects' }
  }
  if (
    path === `${CORE_ADMIN_BASE}/users/groups` ||
    path.startsWith(`${CORE_ADMIN_BASE}/users/groups/`)
  ) {
    return { type: 'resource', key: 'admin.groups' }
  }
  if (path === `${CORE_ADMIN_BASE}/users` || path.startsWith(`${CORE_ADMIN_BASE}/users/`)) {
    return { type: 'resource', key: 'admin.users' }
  }
  if (
    path === `${CORE_ADMIN_BASE}/page-settings` ||
    path.startsWith(`${CORE_ADMIN_BASE}/page-settings/`)
  ) {
    return { type: 'resource', key: 'admin.page-settings' }
  }
  if (
    path === `${CORE_ADMIN_BASE}/layouts` ||
    path.startsWith(`${CORE_ADMIN_BASE}/layouts/`) ||
    path === `${CORE_ADMIN_BASE}/breakpoints` ||
    path.startsWith(`${CORE_ADMIN_BASE}/breakpoints/`) ||
    path === `${CORE_ADMIN_BASE}/outlines` ||
    path.startsWith(`${CORE_ADMIN_BASE}/outlines/`) ||
    path === `${CORE_ADMIN_BASE}/assigned-menu` ||
    path.startsWith(`${CORE_ADMIN_BASE}/assigned-menu/`) ||
    path === `${CORE_ADMIN_BASE}/skins` ||
    path.startsWith(`${CORE_ADMIN_BASE}/skins/`)
  ) {
    return { type: 'resource', key: 'admin.layouts' }
  }
  if (path === `${CORE_ADMIN_BASE}/cms` || path.startsWith(`${CORE_ADMIN_BASE}/cms/`)) {
    return { type: 'resource', key: 'admin.cms' }
  }
  if (path === `${CORE_ADMIN_BASE}/media` || path.startsWith(`${CORE_ADMIN_BASE}/media/`)) {
    return { type: 'app-admin' }
  }
  // No matrix key. Members cannot open it. Developer-admin is enforced on the page.
  if (path === `${CORE_ADMIN_BASE}/audit` || path.startsWith(`${CORE_ADMIN_BASE}/audit/`)) {
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
  { key: 'admin.dashboard', href: CORE_ADMIN_BASE },
  { key: 'admin.users', href: `${CORE_ADMIN_BASE}/users` },
  { key: 'admin.nav', href: `${CORE_ADMIN_BASE}/nav` },
  { key: 'admin.layouts', href: `${CORE_ADMIN_BASE}/layouts` },
  { key: 'admin.forms', href: `${CORE_ADMIN_BASE}/forms` },
  { key: 'admin.email-manager', href: `${CORE_ADMIN_BASE}/email` },
  { key: 'admin.subscriptions', href: `${CORE_ADMIN_BASE}/subscriptions` },
  { key: 'admin.events', href: `${CORE_ADMIN_BASE}/events` },
  { key: 'admin.profiles', href: `${CORE_ADMIN_BASE}/profiles` },
  { key: 'admin.maps', href: `${CORE_ADMIN_BASE}/maps` },
  { key: 'admin.page-settings', href: `${CORE_ADMIN_BASE}/page-settings` },
  { key: 'admin.settings', href: `${CORE_ADMIN_BASE}/settings` },
  { key: 'admin.site-chrome', href: `${CORE_ADMIN_BASE}/site-chrome` },
  { key: 'admin.localization', href: `${CORE_ADMIN_BASE}/localization` },
  { key: 'admin.redirects', href: `${CORE_ADMIN_BASE}/redirects` },
  { key: 'admin.groups', href: `${CORE_ADMIN_BASE}/users/groups` },
  { key: 'admin.cms', href: `${CORE_ADMIN_BASE}/cms` },
  { key: 'admin.environment', href: `${CORE_ADMIN_BASE}/site-chrome/environment` },
]

/** First Core admin landing path for this viewer (app admins → Dashboard). */
export function firstAdminLandingPath(input: {
  isAppAdmin: boolean
  allowed: ReadonlySet<AclAdminResourceKey>
}): string {
  if (input.isAppAdmin) return CORE_ADMIN_BASE
  for (const entry of LANDING_ORDER) {
    if (input.allowed.has(entry.key)) return entry.href
  }
  return `${CORE_ADMIN_BASE}/nav`
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
