/**
 * User groups + ACL foundation types (SF-41).
 *
 * Built-in nav access levels `public` / `registered` are not groups.
 * Custom levels use `group:<groupId>` against `sf_user_groups.id`.
 */

/** Admin-area resources for the Users → ACL permission matrix. */
export const ACL_ADMIN_RESOURCES = [
  { key: 'admin.dashboard', label: 'Dashboard' },
  { key: 'admin.users', label: 'Users — accounts' },
  { key: 'admin.groups', label: 'Users — groups' },
  { key: 'admin.settings', label: 'Settings (Modules)' },
  { key: 'admin.site-chrome', label: 'Chrome' },
  { key: 'admin.localization', label: 'Localization' },
  { key: 'admin.environment', label: 'Environment (.env.local)' },
  { key: 'admin.nav', label: 'Navigation manager' },
  { key: 'admin.forms', label: 'Forms' },
  { key: 'admin.email-manager', label: 'Email Manager' },
  { key: 'admin.payments', label: 'Payments' },
  { key: 'admin.payments-merchant', label: 'Payments — merchant (organizer/vendor)' },
  { key: 'admin.events', label: 'Events' },
  { key: 'admin.profiles', label: 'Profiles' },
  { key: 'admin.maps', label: 'TacMap' },
  { key: 'admin.redirects', label: 'Redirects' },
  { key: 'admin.layouts', label: 'Layouts' },
  { key: 'admin.page-settings', label: 'Page settings' },
  { key: 'admin.cms', label: 'Payload CMS' },
] as const

export type AclAdminResourceKey = (typeof ACL_ADMIN_RESOURCES)[number]['key']

export const ACL_ADMIN_RESOURCE_KEYS: AclAdminResourceKey[] = ACL_ADMIN_RESOURCES.map(
  (r) => r.key,
)

export function isAclAdminResourceKey(value: unknown): value is AclAdminResourceKey {
  return (
    typeof value === 'string' &&
    (ACL_ADMIN_RESOURCE_KEYS as readonly string[]).includes(value)
  )
}

export type UserGroup = {
  id: string
  label: string
  description: string | null
  createdAt: Date
  updatedAt: Date
  memberCount: number
}

export type UserGroupOption = {
  id: string
  label: string
}

/** Viewer context for nav / ACL checks. */
export type AccessViewer = {
  /** Signed-in core user id, or null for anonymous. */
  userId: string | null
  /** True when signed in (any role). */
  isRegistered: boolean
  /** Global app admin — bypasses group ACL grants. */
  isAppAdmin: boolean
  /** Group ids this user belongs to. */
  groupIds: string[]
}

export type AclPermissionRow = {
  resource: AclAdminResourceKey
  label: string
  allowed: boolean
}
