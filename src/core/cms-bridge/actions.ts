'use server'

import { requireAppAdmin } from '@/core/auth/admin'
import { ensurePayloadCmsUser, findPayloadCmsUserByEmail, getCmsBridgePassword } from './index'

export type CmsBridgeActionState = {
  ok: boolean
  message: string
  status?: 'created' | 'exists'
  email?: string
  /** Shown only after a fresh create so the admin knows what to type at /admin. */
  bridgePasswordHint?: string
}

/**
 * Ensure the signed-in global admin has a linked Payload CMS editor (same email).
 * Creates with `STARFORGE_CMS_BRIDGE_PASSWORD` (or default) when missing.
 */
export async function ensureMyCmsBridgeAccount(): Promise<CmsBridgeActionState> {
  const session = await requireAppAdmin()
  if (!session?.user?.email) {
    return { ok: false, message: 'Sign in as a core app admin first.' }
  }

  const email = session.user.email.trim().toLowerCase()
  const existing = await findPayloadCmsUserByEmail(email)
  if (existing) {
    return {
      ok: true,
      status: 'exists',
      email,
      message: `CMS editor already linked for ${email}. Open /admin and sign in with that email (and the password you set for Payload — seed/bootstrap uses the CMS bridge password).`,
    }
  }

  const password = getCmsBridgePassword()
  const result = await ensurePayloadCmsUser({
    email,
    password,
    name: session.user.name ?? undefined,
  })

  if (!result.ok) {
    return { ok: false, message: result.error }
  }

  return {
    ok: true,
    status: result.status,
    email,
    bridgePasswordHint: password,
    message:
      result.status === 'created'
        ? `Created Payload CMS editor for ${email}. Sign in at /admin with this email and the CMS bridge password shown below.`
        : `CMS editor already linked for ${email}.`,
  }
}
