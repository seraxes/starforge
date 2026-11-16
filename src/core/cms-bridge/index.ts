/**
 * CMS access for Better Auth users.
 *
 * `sf_users.cms_access` is the flag. Editorial pages and draft preview read it.
 * There is no second user store and no second password.
 */
import { eq } from 'drizzle-orm'

import { db, sfUsers } from '@/core/db'

/** Seed bootstrap admin email (core `/login` → `/admin` when cmsAccess). */
export const BOOTSTRAP_ADMIN_EMAIL = 'admin@starforge.local'

export type CoreCmsAccessRow = {
  id: string
  email: string
  role: string
  banned: boolean
  cmsAccess: boolean
}

/** Effective CMS right: explicit `cms_access` flag only (admins get it set by default). */
export function userHasCmsAccess(
  user: { cmsAccess?: boolean | null } | null | undefined,
): boolean {
  return Boolean(user?.cmsAccess)
}

export async function loadCoreUserCmsAccess(userId: string): Promise<CoreCmsAccessRow | null> {
  const [row] = await db
    .select({
      id: sfUsers.id,
      email: sfUsers.email,
      role: sfUsers.role,
      banned: sfUsers.banned,
      cmsAccess: sfUsers.cmsAccess,
    })
    .from(sfUsers)
    .where(eq(sfUsers.id, userId))
    .limit(1)

  if (!row) return null
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    banned: Boolean(row.banned),
    cmsAccess: Boolean(row.cmsAccess),
  }
}

/**
 * Persist `cms_access`.
 * Admins flipping this off keep their app role; they lose editorial page access.
 */
export async function setCoreUserCmsAccess(
  userId: string,
  enabled: boolean,
): Promise<{ ok: true; cmsAccess: boolean } | { ok: false; error: string }> {
  const [row] = await db
    .select({ id: sfUsers.id })
    .from(sfUsers)
    .where(eq(sfUsers.id, userId))
    .limit(1)

  if (!row) {
    return { ok: false, error: 'User not found.' }
  }

  await db
    .update(sfUsers)
    .set({
      cmsAccess: enabled,
      updatedAt: new Date(),
    })
    .where(eq(sfUsers.id, userId))

  return { ok: true, cmsAccess: enabled }
}

/** Grant CMS access for a list of core users (seed / bootstrap). */
export async function ensureCmsAccessForCoreUserIds(
  userIds: string[],
): Promise<{ enabled: string[]; failed: { id: string; error: string }[] }> {
  const enabled: string[] = []
  const failed: { id: string; error: string }[] = []
  const seen = new Set<string>()

  for (const id of userIds) {
    if (!id || seen.has(id)) continue
    seen.add(id)
    const result = await setCoreUserCmsAccess(id, true)
    if (result.ok) enabled.push(id)
    else failed.push({ id, error: result.error })
  }

  return { enabled, failed }
}
