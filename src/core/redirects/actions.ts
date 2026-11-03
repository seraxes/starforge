'use server'

import { revalidatePath } from 'next/cache'

import { requireAppAdmin } from '@/core/auth/admin'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { deleteRedirect, listRedirects, upsertRedirect } from './store'
import type { RedirectAdminActionState } from './types'

export type { RedirectAdminActionState }

async function requireRedirectsAdmin(): Promise<RedirectAdminActionState | null> {
  const admin = await requireAppAdmin()
  if (!admin) {
    return { error: 'Sign in as a Starforge app admin to manage redirects.' }
  }
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.redirects)) {
    return { error: 'Redirects module is off. Enable it under Settings → Modules.' }
  }
  return null
}

function revalidateRedirectPaths() {
  revalidatePath('/app/admin/redirects')
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

  const result = await upsertRedirect({
    fromPath: String(formData.get('fromPath') ?? ''),
    toUrl: String(formData.get('toUrl') ?? ''),
    statusCode: formData.get('statusCode'),
    enabled: String(formData.get('enabled') ?? '1') === '1',
    note: String(formData.get('note') ?? ''),
  })

  if (!result.ok) return { error: result.error }

  revalidateRedirectPaths()
  return {
    ok: true,
    message: `Redirect “${result.record.fromPath}” → “${result.record.toUrl}” created.`,
    redirectId: result.record.id,
  }
}

export async function updateRedirectAction(
  _prev: RedirectAdminActionState,
  formData: FormData,
): Promise<RedirectAdminActionState> {
  const denied = await requireRedirectsAdmin()
  if (denied) return denied

  const id = String(formData.get('id') ?? '').trim()
  if (!id) return { error: 'Missing redirect id.' }

  const result = await upsertRedirect({
    id,
    fromPath: String(formData.get('fromPath') ?? ''),
    toUrl: String(formData.get('toUrl') ?? ''),
    statusCode: formData.get('statusCode'),
    enabled: String(formData.get('enabled') ?? '') === '1',
    note: String(formData.get('note') ?? ''),
  })

  if (!result.ok) return { error: result.error }

  revalidateRedirectPaths()
  return {
    ok: true,
    message: `Redirect “${result.record.fromPath}” saved.`,
    redirectId: result.record.id,
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
  if (!result.ok) return { error: result.error }

  revalidateRedirectPaths()
  return { ok: true, message: 'Redirect deleted.' }
}
