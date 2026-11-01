/**
 * User groups + ACL foundation types (SF-41).
 *
 * Built-in nav access levels `public` / `registered` are not groups.
 * Custom levels use `group:<groupId>` against `sf_user_groups.id`.
 */

/** Admin-area resources for the stub permission matrix. */
export const ACL_ADMIN_RESOURCES = [
  { key: 'admin.users', label: 'Users — accounts' },
  { key: 'admin.groups', label: 'Users — groups' },
  { key: 'admin.settings', label: 'Site settings (Modules)' },
  { key: 'admin.site-chrome', label: 'Site Chrome' },
  { key: 'admin.nav', label: 'Nav manager' },
  { key: 'admin.forms', label: 'Forms' },
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
  /** Global app admin — bypasses group ACL stubs. */
  isAppAdmin: boolean
  /** Group ids this user belongs to. */
  groupIds: string[]
}

export type AclPermissionRow = {
  resource: AclAdminResourceKey
  label: string
  allowed: boolean
}
