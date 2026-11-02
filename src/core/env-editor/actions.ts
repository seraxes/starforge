'use server'

import { revalidatePath } from 'next/cache'

import { requireDeveloperAdmin } from '@/core/auth/admin'

import { ENV_EDITOR_FIELDS, ENV_EDITOR_KEY_SET } from './catalog'
import {
  clearEnvEditorGateCookie,
  requireEnvEditorGate,
  setEnvEditorGateCookie,
  verifyDeveloperAdminPassword,
} from './gate'
import { saveEnvOverlay } from './store'

export type EnvEditorGateActionState = {
  error?: string
  ok?: boolean
  expiresAt?: number
}

export type EnvEditorSaveActionState = {
  error?: string
  ok?: boolean
  changedKeys?: string[]
  message?: string
}

export type EnvEditorLockActionState = {
  error?: string
  ok?: boolean
}

export async function unlockEnvEditorAction(
  _prev: EnvEditorGateActionState,
  formData: FormData,
): Promise<EnvEditorGateActionState> {
  const admin = await requireDeveloperAdmin()
  if (!admin?.user) {
    return {
      error:
        'Developer-admin only. Set STARFORGE_DEVELOPER_ADMIN_EMAILS or leave it empty so all app admins qualify.',
    }
  }

  const password = String(formData.get('password') ?? '')
  const verified = await verifyDeveloperAdminPassword(password)
  if (!verified.ok) {
    return { error: verified.error }
  }

  const expiresAt = await setEnvEditorGateCookie(verified.userId)
  revalidatePath('/app/admin/site-chrome/environment')
  return { ok: true, expiresAt }
}

export async function lockEnvEditorAction(
  _prev: EnvEditorLockActionState,
  _formData: FormData,
): Promise<EnvEditorLockActionState> {
  const admin = await requireDeveloperAdmin()
  if (!admin?.user) {
    return { error: 'Not authorized.' }
  }
  await clearEnvEditorGateCookie()
  revalidatePath('/app/admin/site-chrome/environment')
  return { ok: true }
}

export async function saveEnvEditorAction(
  _prev: EnvEditorSaveActionState,
  formData: FormData,
): Promise<EnvEditorSaveActionState> {
  const gate = await requireEnvEditorGate()
  if (!gate.ok) {
    return { error: gate.error }
  }

  const values: Record<string, string> = {}
  for (const field of ENV_EDITOR_FIELDS) {
    if (!ENV_EDITOR_KEY_SET.has(field.key)) continue
    const raw = formData.get(`env.${field.key}`)
    if (typeof raw !== 'string') continue
    values[field.key] = raw
  }

  const result = await saveEnvOverlay({ values })
  if (!result.ok) {
    return { error: result.error }
  }

  revalidatePath('/app/admin/site-chrome/environment')
  revalidatePath('/app/admin/site-chrome')

  const count = result.changedKeys.length
  return {
    ok: true,
    changedKeys: result.changedKeys,
    message:
      count === 0
        ? 'No changes written. Restart is still required only after a real write.'
        : `Wrote ${count} key${count === 1 ? '' : 's'} to .env.local. Restart next dev / the Node process for Next to reload env (including NEXT_PUBLIC_*).`,
  }
}
