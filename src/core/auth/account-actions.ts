'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { APIError } from 'better-auth/api'

import { auth } from './index'
import { deleteAccountSchema } from './schemas'

export type DeleteAccountActionState = {
  error?: string
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

/**
 * Delete the signed-in member's auth user (Better Auth). Always uses the session
 * user — never accepts another account id from the form.
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
    await auth.api.deleteUser({
      body: { password: parsed.data.password },
      headers: await headers(),
    })
  } catch (error) {
    const message = toErrorMessage(error, 'Could not delete your account')
    // FK / DB constraint — report the failure; do not invent Events/Payments cascades.
    if (/foreign key|violates|constraint/i.test(message)) {
      return {
        error:
          'Your account could not be deleted because related data still references it. Contact support.',
      }
    }
    return { error: message }
  }

  try {
    const { clearPayloadAdminSession } = await import('@/core/cms-bridge/payload-session')
    await clearPayloadAdminSession()
  } catch {
    // ignore
  }

  redirect('/login')
}
