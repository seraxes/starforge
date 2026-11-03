'use server'

import { revalidatePath } from 'next/cache'

import { requireAppAdmin } from '@/core/auth/admin'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import {
  createRedirect,
  deleteRedirect,
  listRedirects,
  updateRedirect,
} from './store'
import { isRedirectStatusCode, type RedirectAdminActionState } from './types'

export type { RedirectAdminActionState }

async function requireRedirectsAdmin(): Promise<RedirectAdminActionState | null> {
  const admin = await requireAppAdmin()
  if (!admin) {
    return { error: 'Sign in as a Starforge app admin to manage redirects.' }
  }
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.redirects)) {
    return { error: 'Redirects module is disabled. Enable it under Settings → Modules.' }
  }
  return null
}

function revalidateRedirectPaths() {
  revalidatePath('/app/admin/redirects')
}

function parseStatus(raw: FormDataEntryValue | null): number {
  const n = Number(String(raw ?? '').trim())
  return Number.isFinite(n) ? n : 301
}

export async function listRedirectsForAdmin() {
  const denied = await requireRedirectsAdmin()
  if (denied) return []
  return listRedirects()
}

export async function createRedirectAction(
  _prev: RedirectAdminActionState,
  formData: FormData,
): Promise<RedirectAdminActionState> {
  const denied = await requireRedirectsAdmin()
  if (denied) return denied

  const result = await createRedirect({
    fromPath: String(formData.get('fromPath') ?? ''),
    toPath: String(formData.get('toPath') ?? ''),
    statusCode: parseStatus(formData.get('statusCode')),
    enabled: String(formData.get('enabled') ?? '1') !== '0',
    note: String(formData.get('note') ?? ''),
  })

  if ('error' in result) return { error: result.error }

  revalidateRedirectPaths()
  return {
    ok: true,
    message: `Redirect “${result.redirect.fromPath}” → “${result.redirect.toPath}” created.`,
    redirectId: result.redirect.id,
  }
}

export async function updateRedirectAction(
  _prev: RedirectAdminActionState,
  formData: FormData,
): Promise<RedirectAdminActionState> {
  const denied = await requireRedirectsAdmin()
  if (denied) return denied

  const id = String(formData.get('id') ?? '').trim()
  const statusRaw = String(formData.get('statusCode') ?? '').trim()
  const statusCode = statusRaw ? parseStatus(statusRaw) : undefined
  // Checkbox: present → on; omitted → off (Save form always includes the control).
  const enabled = formData
    .getAll('enabled')
    .map((v) => String(v))
    .some((v) => v === '1' || v === 'on')

  const result = await updateRedirect({
    id,
    fromPath: String(formData.get('fromPath') ?? ''),
    toPath: String(formData.get('toPath') ?? ''),
    ...(statusCode !== undefined && isRedirectStatusCode(statusCode)
      ? { statusCode }
      : {}),
    enabled,
    note: String(formData.get('note') ?? ''),
  })

  if ('error' in result) return { error: result.error }

  revalidateRedirectPaths()
  return {
    ok: true,
    message: `Redirect “${result.redirect.fromPath}” saved.`,
    redirectId: result.redirect.id,
  }
}

export async function toggleRedirectEnabledAction(
  _prev: RedirectAdminActionState,
  formData: FormData,
): Promise<RedirectAdminActionState> {
  const denied = await requireRedirectsAdmin()
  if (denied) return denied

  const id = String(formData.get('id') ?? '').trim()
  const enabled = String(formData.get('enabled') ?? '') === '1'

  const result = await updateRedirect({ id, enabled })
  if ('error' in result) return { error: result.error }

  revalidateRedirectPaths()
  return {
    ok: true,
    message: enabled
      ? `Redirect “${result.redirect.fromPath}” enabled.`
      : `Redirect “${result.redirect.fromPath}” disabled.`,
    redirectId: result.redirect.id,
  }
}

export async function deleteRedirectAction(
  _prev: RedirectAdminActionState,
  formData: FormData,
): Promise<RedirectAdminActionState> {
  const denied = await requireRedirectsAdmin()
  if (denied) return denied

  const id = String(formData.get('id') ?? '').trim()
  const result = await deleteRedirect(id)
  if ('error' in result) return { error: result.error }

  revalidateRedirectPaths()
  return { ok: true, message: 'Redirect deleted.' }
}
