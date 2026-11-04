import { emailIsBootstrapAdmin } from './bootstrap-admins'
import { normalizeAppRole } from './permissions'

type EnvLike = Record<string, string | undefined>

function isAppAdmin(
  user: { role?: string | null; email?: string | null } | null | undefined,
): boolean {
  if (!user) return false
  if (normalizeAppRole(user.role) === 'admin') return true
  if (user.email && emailIsBootstrapAdmin(user.email)) return true
  return false
}

/**
 * Developer-admin: can edit script-capable Page Settings / Custom JS fields.
 * Emails from `STARFORGE_DEVELOPER_ADMIN_EMAILS`. Empty list is fail-closed in
 * production (nobody); outside production, all app admins qualify (local default).
 */
export function getDeveloperAdminEmails(env: EnvLike = process.env): string[] {
  const raw = env.STARFORGE_DEVELOPER_ADMIN_EMAILS ?? ''
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

/** Empty allowlist opens to all app admins only when not running as production. */
export function emptyDeveloperAdminEmailsGrantAllAdmins(
  env: EnvLike = process.env,
): boolean {
  return (env.NODE_ENV ?? '').trim() !== 'production'
}

export function userIsDeveloperAdmin(
  user: { role?: string | null; email?: string | null } | null | undefined,
  env: EnvLike = process.env,
): boolean {
  if (!isAppAdmin(user)) return false
  const list = getDeveloperAdminEmails(env)
  if (list.length === 0) return emptyDeveloperAdminEmailsGrantAllAdmins(env)
  const email = user?.email?.trim().toLowerCase()
  return Boolean(email && list.includes(email))
}
