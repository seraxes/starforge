'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { APIError } from 'better-auth/api'
import { revalidatePath } from 'next/cache'

import { auth } from './index'
import { deleteAccountSchema } from './schemas'
import { requireAppAdmin } from './admin'
import {
  actorFromUser,
  approveFinalDeleteInDb,
  callAccountPurgeDoors,
  hideAccountInDb,
  loadAccountRetentionState,
  restoreAccountInDb,
  setLegalHoldInDb,
} from './account-retention-store'
import { isAccountPubliclyAbsent } from './account-retention'

export type DeleteAccountActionState = {
  error?: string
  /** Set when the account was hidden (retention clock started). */
  hidden?: boolean
}

export type RestoreAccountActionState = {
  error?: string
  ok?: boolean
}

export type FinalDeleteAccountActionState = {
  error?: string
  ok?: boolean
}

export type LegalHoldActionState = {
  error?: string
  ok?: boolean
  legalHold?: boolean
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

function refuseMessage(reason: string): string {
  switch (reason) {
    case 'staff_account':
      return 'A staff account cannot be hidden or deleted this way.'
    case 'too_early':
      return 'Final delete is only allowed after the retention wait.'
    case 'legal_hold':
      return 'Final delete is blocked while a legal hold is set.'
    case 'not_hidden':
      return 'That account is not in the retention wait.'
    case 'forbidden':
      return 'You do not have permission for that action.'
    case 'not_found':
      return 'Account not found.'
    default:
      return 'Could not update the account.'
  }
}

/**
 * Hide the signed-in member's account (retention clock). Does not call
 * `deleteUser`. Always uses the session user — never accepts another account
 * id from the form.
 */
export async function deleteAccountAction(
  _prev: DeleteAccountActionState,
  formData: FormData,
): Promise<DeleteAccountActionState> {
  const parsed = deleteAccountSchema.safeParse({
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid form' }
  }

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return { error: 'Sign in to delete your account.' }
  }

  try {
    await auth.api.verifyPassword({
      body: { password: parsed.data.password },
      headers: await headers(),
    })
  } catch {
    return { error: 'Password incorrect.' }
  }

  const result = await hideAccountInDb(
    session.user.id,
    actorFromUser(session.user),
  )
  if (!result.ok) {
    return { error: refuseMessage(result.reason) }
  }

  try {
    const { clearAdminSession } = await import('./admin-session')
    await clearAdminSession()
  } catch {
    // ignore
  }

  try {
    await auth.api.signOut({ headers: await headers() })
  } catch {
    // ignore — hide already persisted
  }

  redirect('/login?notice=account-hidden')
}

/**
 * Restore a retention-hidden account (self during the wait, or staff restore).
 */
export async function restoreAccountAction(
  _prev: RestoreAccountActionState,
  formData: FormData,
): Promise<RestoreAccountActionState> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return { error: 'Sign in to restore your account.' }
  }

  const targetId =
    String(formData.get('userId') ?? '').trim() || session.user.id
  const result = await restoreAccountInDb(targetId, actorFromUser(session.user))
  if (!result.ok) {
    return { error: refuseMessage(result.reason) }
  }

  revalidatePath('/account')
  revalidatePath('/login')
  revalidatePath('/admin/users')
  if (targetId !== session.user.id) {
    revalidatePath(`/admin/users/${targetId}`)
  }
  return { ok: true }
}

/**
 * Staff sets or clears a legal hold (keeps rows past purgeEligibleAt).
 */
export async function setAccountLegalHoldAction(
  _prev: LegalHoldActionState,
  formData: FormData,
): Promise<LegalHoldActionState> {
  const adminSession = await requireAppAdmin()
  if (!adminSession?.user) {
    return { error: 'Sign in as a Starforge app admin to set a legal hold.' }
  }

  const userId = String(formData.get('userId') ?? '').trim()
  const hold = String(formData.get('legalHold') ?? '') === 'true'
  if (!userId) return { error: 'Missing user id.' }

  const result = await setLegalHoldInDb(
    userId,
    actorFromUser(adminSession.user),
    hold,
  )
  if (!result.ok) {
    return { error: refuseMessage(result.reason) }
  }

  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${userId}`)
  return { ok: true, legalHold: result.account.legalHold }
}

/**
 * Final delete after purgeEligibleAt with no legal hold. Calls each pack’s
 * purge door (including `purgeOwnSocialRecord`), then Better Auth `deleteUser`.
 */
export async function approveFinalDeleteAccountAction(
  _prev: FinalDeleteAccountActionState,
  formData: FormData,
): Promise<FinalDeleteAccountActionState> {
  const adminSession = await requireAppAdmin()
  if (!adminSession?.user) {
    return { error: 'Sign in as a Starforge app admin to approve final delete.' }
  }

  const userId = String(formData.get('userId') ?? '').trim()
  if (!userId) return { error: 'Missing user id.' }

  const decided = await approveFinalDeleteInDb(
    userId,
    actorFromUser(adminSession.user),
  )
  if (!decided.ok) {
    return { error: refuseMessage(decided.reason) }
  }

  await callAccountPurgeDoors(userId)

  try {
    await auth.api.removeUser({
      body: { userId },
      headers: await headers(),
    })
  } catch (error) {
    // Fallback: direct delete via Better Auth admin plugin naming.
    try {
      const { db, sfUsers } = await import('@/core/db')
      const { eq } = await import('drizzle-orm')
      await db.delete(sfUsers).where(eq(sfUsers.id, userId))
    } catch (fallbackError) {
      return {
        error: toErrorMessage(
          fallbackError ?? error,
          'Pack data was purged but the auth user could not be deleted.',
        ),
      }
    }
  }

  revalidatePath('/admin/users')
  return { ok: true }
}

/** Session helper: whether the signed-in user should see the restore offer. */
export async function getSignedInRetentionOffer(): Promise<{
  hidden: boolean
  purgeEligibleAt: string | null
} | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) return null
  const state = await loadAccountRetentionState(session.user.id)
  if (!state || !isAccountPubliclyAbsent(state)) {
    return { hidden: false, purgeEligibleAt: null }
  }
  return {
    hidden: true,
    purgeEligibleAt: state.purgeEligibleAt?.toISOString() ?? null,
  }
}
