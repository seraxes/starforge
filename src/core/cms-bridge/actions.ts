'use server'

import { revalidatePath } from 'next/cache'

import { requireAppAdmin } from '@/core/auth/admin'
import { db, sfUsers } from '@/core/db'
import { eq } from 'drizzle-orm'
import { setCoreUserCmsAccess } from './index'

export type CmsAccessActionState = {
  error?: string
  ok?: boolean
  cmsAccess?: boolean
}

/**
 * Toggle CMS access for a core app user (provisions or revokes Payload stub).
 */
export async function setAppUserCmsAccessAction(
  _prev: CmsAccessActionState,
  formData: FormData,
): Promise<CmsAccessActionState> {
  const adminSession = await requireAppAdmin()
  if (!adminSession) {
    return { error: 'Sign in as a Starforge app admin to manage CMS access.' }
  }

  const userId = String(formData.get('userId') ?? '').trim()
  const enabled = String(formData.get('cmsAccess') ?? '') === 'true'

  if (!userId) {
    return { error: 'Missing user id.' }
  }

  if (userId === adminSession.user.id && !enabled) {
    return { error: 'You cannot remove your own CMS access.' }
  }

  const [target] = await db
    .select({ id: sfUsers.id })
    .from(sfUsers)
    .where(eq(sfUsers.id, userId))
    .limit(1)

  if (!target) {
    return { error: 'User not found.' }
  }

  const result = await setCoreUserCmsAccess(userId, enabled)
  if (!result.ok) {
    return { error: result.error }
  }

  revalidatePath('/app/admin/users')
  revalidatePath('/app/admin/cms')
  return { ok: true, cmsAccess: result.cmsAccess }
}
