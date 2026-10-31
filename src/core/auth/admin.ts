import { eq } from 'drizzle-orm'

import { db, sfUsers } from '@/core/db'
import { getBootstrapAdminEmails, emailIsBootstrapAdmin } from './bootstrap-admins'
import { getAppSession } from './session'
import { DEFAULT_APP_ROLE, normalizeAppRole, type AppRole } from './permissions'

export { getBootstrapAdminEmails, emailIsBootstrapAdmin }

export function roleFromUser(user: { role?: string | null } | null | undefined): AppRole {
  return normalizeAppRole(user?.role)
}

export function userIsAppAdmin(user: { role?: string | null; email?: string | null } | null | undefined): boolean {
  if (!user) return false
  if (roleFromUser(user) === 'admin') return true
  if (user.email && emailIsBootstrapAdmin(user.email)) return true
  return false
}

/**
 * If the signed-in email is listed in STARFORGE_ADMIN_EMAILS, persist role=admin
 * on this request (idempotent). Lets an existing member become admin after env
 * change + server restart without re-registering.
 */
export async function promoteSessionUserIfBootstrapAdmin(user: {
  id: string
  email?: string | null
  role?: string | null
} | null | undefined): Promise<boolean> {
  if (!user?.id || !user.email || !emailIsBootstrapAdmin(user.email)) {
    return false
  }
  if (normalizeAppRole(user.role) === 'admin') {
    return true
  }
  await db
    .update(sfUsers)
    .set({
      role: 'admin',
      updatedAt: new Date(),
    })
    .where(eq(sfUsers.id, user.id))
  return true
}

/** Current session must be a core app admin; otherwise `null`. */
export async function requireAppAdmin() {
  const session = await getAppSession()
  if (!session?.user) return null
  await promoteSessionUserIfBootstrapAdmin(session.user)
  if (!userIsAppAdmin(session.user)) return null
  return session
}

/** Promote matching emails to admin (idempotent). Used by seed + signup hook. */
export async function promoteBootstrapAdminsByEmail(emails?: string[]) {
  const list = new Set((emails ?? getBootstrapAdminEmails()).map((e) => e.toLowerCase()))
  if (list.size === 0) {
    return { promoted: [] as string[] }
  }

  const all = await db.select({ id: sfUsers.id, email: sfUsers.email, role: sfUsers.role }).from(sfUsers)
  const promoted: string[] = []

  for (const row of all) {
    if (!list.has(row.email.toLowerCase())) continue
    if (normalizeAppRole(row.role) === 'admin') {
      promoted.push(row.email)
      continue
    }
    await db
      .update(sfUsers)
      .set({
        role: 'admin',
        updatedAt: new Date(),
      })
      .where(eq(sfUsers.id, row.id))
    promoted.push(row.email)
  }

  return { promoted }
}

export async function setUserRole(userId: string, role: AppRole) {
  const [row] = await db
    .update(sfUsers)
    .set({
      role,
      updatedAt: new Date(),
    })
    .where(eq(sfUsers.id, userId))
    .returning({
      id: sfUsers.id,
      email: sfUsers.email,
      role: sfUsers.role,
    })

  return row ?? null
}

export async function setUserDisabled(
  userId: string,
  disabled: boolean,
  reason = 'Disabled by admin',
) {
  const [row] = await db
    .update(sfUsers)
    .set(
      disabled
        ? {
            banned: true,
            banReason: reason,
            banExpires: null,
            updatedAt: new Date(),
          }
        : {
            banned: false,
            banReason: null,
            banExpires: null,
            updatedAt: new Date(),
          },
    )
    .where(eq(sfUsers.id, userId))
    .returning({
      id: sfUsers.id,
      email: sfUsers.email,
      banned: sfUsers.banned,
      banReason: sfUsers.banReason,
    })

  return row ?? null
}

export { DEFAULT_APP_ROLE }
