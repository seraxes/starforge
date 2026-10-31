/**
 * Global-admin / CMS-access bridge (one login).
 *
 * Product users stay in Better Auth (`sf_*`). Payload `users` remain CMS
 * editor stubs linked by `coreUserId` / email. Authentication for `/admin` uses
 * the Better Auth session via `starforgeCoreSessionStrategy` — never a second
 * password. Payload stays a swappable content module.
 */
import { eq } from 'drizzle-orm'
import { getPayload } from 'payload'

import config from '@payload-config'
import { db, sfUsers } from '@/core/db'

/** Seed bootstrap admin email (core `/login` → also opens `/admin` when cmsAccess). */
export const BOOTSTRAP_ADMIN_EMAIL = 'admin@starforge.local'

export type EnsureCmsUserInput = {
  coreUserId: string
  email: string
  name?: string | null
}

export type EnsureCmsUserResult =
  | { ok: true; status: 'created' | 'exists' | 'updated'; email: string; id: number | string }
  | { ok: false; error: string }

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

export async function findPayloadCmsUserByCoreUserId(coreUserId: string) {
  const payload = await getPayload({ config })
  const found = await payload.find({
    collection: 'users',
    where: { coreUserId: { equals: coreUserId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return found.docs[0] ?? null
}

export async function findPayloadCmsUserByEmail(email: string) {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return null

  const payload = await getPayload({ config })
  const found = await payload.find({
    collection: 'users',
    where: { email: { equals: normalized } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return found.docs[0] ?? null
}

/**
 * Idempotent: create/link a Payload CMS editor stub for a core user.
 * No password — auth is via Better Auth session strategy only.
 */
export async function ensurePayloadCmsUser(
  input: EnsureCmsUserInput,
): Promise<EnsureCmsUserResult> {
  const email = input.email.trim().toLowerCase()
  const coreUserId = input.coreUserId.trim()
  if (!coreUserId || !email || !email.includes('@')) {
    return { ok: false, error: 'coreUserId and a valid email are required.' }
  }

  try {
    const byCore = await findPayloadCmsUserByCoreUserId(coreUserId)
    if (byCore) {
      return { ok: true, status: 'exists', email, id: byCore.id }
    }

    const byEmail = await findPayloadCmsUserByEmail(email)
    if (byEmail) {
      const payload = await getPayload({ config })
      const updated = await payload.update({
        collection: 'users',
        id: byEmail.id,
        data: { coreUserId },
        overrideAccess: true,
      })
      return { ok: true, status: 'updated', email, id: updated.id }
    }

    const payload = await getPayload({ config })
    const created = await payload.create({
      collection: 'users',
      data: {
        email,
        coreUserId,
      },
      overrideAccess: true,
    })

    return { ok: true, status: 'created', email, id: created.id }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to ensure CMS user.'
    return { ok: false, error: message }
  }
}

/** Delete the linked Payload editor (revoke CMS access). */
export async function revokePayloadCmsUser(input: {
  coreUserId: string
  email?: string
}): Promise<{ ok: true; status: 'deleted' | 'missing' } | { ok: false; error: string }> {
  try {
    const payload = await getPayload({ config })
    const byCore = await findPayloadCmsUserByCoreUserId(input.coreUserId)
    const byEmail = !byCore && input.email ? await findPayloadCmsUserByEmail(input.email) : null
    const doc = byCore ?? byEmail
    if (!doc) {
      return { ok: true, status: 'missing' }
    }
    await payload.delete({
      collection: 'users',
      id: doc.id,
      overrideAccess: true,
    })
    return { ok: true, status: 'deleted' }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to revoke CMS user.',
    }
  }
}

/**
 * Persist `cms_access` and provision/revoke the Payload stub.
 * Admins flipping this off keep their app role; they just lose `/admin`.
 */
export async function setCoreUserCmsAccess(
  userId: string,
  enabled: boolean,
): Promise<{ ok: true; cmsAccess: boolean } | { ok: false; error: string }> {
  const [row] = await db
    .select({
      id: sfUsers.id,
      email: sfUsers.email,
      name: sfUsers.name,
      cmsAccess: sfUsers.cmsAccess,
    })
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

  if (enabled) {
    const ensured = await ensurePayloadCmsUser({
      coreUserId: row.id,
      email: row.email,
      name: row.name,
    })
    if (!ensured.ok) {
      return { ok: false, error: ensured.error }
    }
  } else {
    const revoked = await revokePayloadCmsUser({
      coreUserId: row.id,
      email: row.email,
    })
    if (!revoked.ok) {
      return { ok: false, error: revoked.error }
    }
  }

  return { ok: true, cmsAccess: enabled }
}

/** Grant CMS access + Payload stub for a list of core users (seed / bootstrap). */
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
