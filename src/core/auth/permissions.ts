import { createAccessControl } from 'better-auth/plugins/access'
import { adminAc, defaultStatements, userAc } from 'better-auth/plugins/admin/access'

/**
 * Starforge app roles (core `sf_users`, not Payload CMS editors).
 *
 * - `admin` — global app admin (core `/app/admin/*`). CMS `/admin` bridge is follow-up.
 * - `member` — default product user (Better Auth defaultRole).
 */
export const APP_ROLES = ['admin', 'member'] as const
export type AppRole = (typeof APP_ROLES)[number]

export const DEFAULT_APP_ROLE: AppRole = 'member'

const statement = {
  ...defaultStatements,
} as const

export const ac = createAccessControl(statement)

export const admin = ac.newRole({
  ...adminAc.statements,
})

export const member = ac.newRole({
  ...userAc.statements,
})

export const appRoles = {
  admin,
  member,
} as const

export function isAppRole(value: unknown): value is AppRole {
  return value === 'admin' || value === 'member'
}

export function normalizeAppRole(value: unknown): AppRole {
  if (value === 'admin') return 'admin'
  // Treat legacy Better Auth default `user` as member.
  if (value === 'user' || value === 'member' || value == null || value === '') {
    return 'member'
  }
  if (typeof value === 'string' && value.split(',').map((part) => part.trim()).includes('admin')) {
    return 'admin'
  }
  return 'member'
}
