import type { AccessArgs, PayloadRequest } from 'payload'

import { userIsAppAdmin } from '@/core/auth/admin'

import { loadCoreUserCmsAccess, userHasCmsAccess } from './index'

function coreUserIdFromPayloadUser(user: PayloadRequest['user']): string | null {
  if (!user || typeof user !== 'object') return null
  const id = (user as { coreUserId?: unknown }).coreUserId
  return typeof id === 'string' && id.trim() ? id.trim() : null
}

async function loadLinkedCoreUser(req: PayloadRequest) {
  const coreUserId = coreUserIdFromPayloadUser(req.user)
  if (!coreUserId) return null
  const row = await loadCoreUserCmsAccess(coreUserId)
  if (!row || row.banned) return null
  return row
}

/** Payload access: linked Core user is a Starforge app admin. */
export async function isCoreAdmin({ req }: AccessArgs): Promise<boolean> {
  const row = await loadLinkedCoreUser(req)
  if (!row) return false
  return userIsAppAdmin(row)
}

/** Payload access: linked Core user has `cms_access` (and is not banned). */
export async function hasCmsAccess({ req }: AccessArgs): Promise<boolean> {
  const row = await loadLinkedCoreUser(req)
  if (!row) return false
  return userHasCmsAccess(row)
}
