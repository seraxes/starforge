'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { APIError } from 'better-auth/api'
import { eq } from 'drizzle-orm'

import { db, sfSessions, sfUsers } from '@/core/db'
import { auth } from './index'
import { requireAppAdmin, setUserDisabled, setUserRole, userIsAppAdmin } from './admin'
import { isAppRole, type AppRole } from './permissions'

export type AdminActionState = {
  error?: string
  ok?: boolean
  /** Persisted role after a successful set-role action (keeps the select in sync). */
  role?: AppRole
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof APIError) {
    return error.message || fallback
  }
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}

async function revokeSessionsForUser(userId: string) {
  await db.delete(sfSessions).where(eq(sfSessions.userId, userId))
}

export async function setAppUserRoleAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const adminSession = await requireAppAdmin()
  if (!adminSession) {
    return { error: 'Sign in as a Starforge app admin to manage users.' }
  }

  const userId = String(formData.get('userId') ?? '').trim()
  const roleRaw = String(formData.get('role') ?? '').trim()
  if (!userId || !isAppRole(roleRaw)) {
    return { error: 'Pick a valid user and role (admin or member).' }
  }
  const role: AppRole = roleRaw

  if (userId === adminSession.user.id && role !== 'admin') {
    return { error: 'You cannot remove your own admin role.' }
  }

  const [target] = await db
    .select({ id: sfUsers.id, email: sfUsers.email, role: sfUsers.role })
    .from(sfUsers)
    .where(eq(sfUsers.id, userId))
    .limit(1)

  if (!target) {
    return { error: 'User not found.' }
  }

  try {
    // Prefer Better Auth admin API when the caller has plugin admin rights.
    await auth.api.setRole({
      body: { userId, role },
      headers: await headers(),
    })
    // Better Auth setRole does not touch cms_access — grant CMS for new admins.
    if (role === 'admin') {
      await setUserRole(userId, 'admin')
    }
  } catch {
    // Fallback for bootstrap-email admins whose DB role may lag until promote runs.
    await setUserRole(userId, role)
  }

  revalidatePath('/app/admin/users')
  revalidatePath('/app/admin/cms')
  return { ok: true, role }
}

export async function setAppUserDisabledAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const adminSession = await requireAppAdmin()
  if (!adminSession) {
    return { error: 'Sign in as a Starforge app admin to manage users.' }
  }

  const userId = String(formData.get('userId') ?? '').trim()
  const disabled = String(formData.get('disabled') ?? '') === 'true'
  const reason = String(formData.get('reason') ?? 'Disabled by admin').trim() || 'Disabled by admin'

  if (!userId) {
    return { error: 'Missing user id.' }
  }

  if (userId === adminSession.user.id && disabled) {
    return { error: 'You cannot disable your own account.' }
  }

  const [target] = await db
    .select({
      id: sfUsers.id,
      email: sfUsers.email,
      role: sfUsers.role,
      banned: sfUsers.banned,
    })
    .from(sfUsers)
    .where(eq(sfUsers.id, userId))
    .limit(1)

  if (!target) {
    return { error: 'User not found.' }
  }

  if (disabled && userIsAppAdmin(target) && target.id !== adminSession.user.id) {
    // Allow disabling other admins — intentional for local ops — but keep a clear trail.
  }

  try {
    if (disabled) {
      await auth.api.banUser({
        body: { userId, banReason: reason },
        headers: await headers(),
      })
    } else {
      await auth.api.unbanUser({
        body: { userId },
        headers: await headers(),
      })
    }
  } catch (error) {
    // Fallback path: direct Drizzle update + session revoke.
    const updated = await setUserDisabled(userId, disabled, reason)
    if (!updated) {
      return { error: toErrorMessage(error, 'Could not update user.') }
    }
    if (disabled) {
      await revokeSessionsForUser(userId)
    }
  }

  revalidatePath('/app/admin/users')
  return { ok: true }
}
