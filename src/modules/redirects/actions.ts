'use server'

import { revalidatePath } from 'next/cache'

import {
  REDIRECT_CREATE_ACTION,
  REDIRECT_DELETE_ACTION,
  REDIRECT_UPDATE_ACTION,
  recordAdminAudit,
  redirectImportAudit,
} from '@/core/audit'
import { requireAppAdmin } from '@/core/auth/admin'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import {
  createRedirect,
  deleteRedirect,
  importRedirectsFromCsv,
  listRedirects,
  updateRedirect,
} from './store'
import { isRedirectStatusCode, type RedirectAdminActionState } from './types'

const CSV_IMPORT_MAX_BYTES = 1_000_000

export type { RedirectAdminActionState }

async function requireRedirectsAdmin(): Promise<{ actorId: string } | { error: string }> {
  const admin = await requireAppAdmin()
  const actorId = admin?.user?.id?.trim()
  if (!actorId) {
    return { error: 'Sign in as a Starforge app admin to manage redirects.' }
  }
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.redirects)) {
    return { error: 'Redirects module is disabled. Enable it under Settings → Modules.' }
  }
  return { actorId }
}

function revalidateRedirectPaths() {
  revalidatePath('/admin/redirects')
}

function parseStatus(raw: FormDataEntryValue | null): number {
  const n = Number(String(raw ?? '').trim())
  return Number.isFinite(n) ? n : 301
}

export async function listRedirectsForAdmin() {
  const gate = await requireRedirectsAdmin()
  if ('error' in gate) return []
  return listRedirects()
}

export async function createRedirectAction(
  _prev: RedirectAdminActionState,
  formData: FormData,
): Promise<RedirectAdminActionState> {
  const gate = await requireRedirectsAdmin()
  if ('error' in gate) return gate

  const result = await createRedirect({
    fromPath: String(formData.get('fromPath') ?? ''),
    toPath: String(formData.get('toPath') ?? ''),
    statusCode: parseStatus(formData.get('statusCode')),
    enabled: String(formData.get('enabled') ?? '1') !== '0',
    note: String(formData.get('note') ?? ''),
  })

  if ('error' in result) return { error: result.error }

  await recordAdminAudit({
    actorId: gate.actorId,
    action: REDIRECT_CREATE_ACTION,
    target: { type: 'redirect', id: result.redirect.id },
  })

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
  const gate = await requireRedirectsAdmin()
  if ('error' in gate) return gate

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

  await recordAdminAudit({
    actorId: gate.actorId,
    action: REDIRECT_UPDATE_ACTION,
    target: { type: 'redirect', id: result.redirect.id },
  })

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
  const gate = await requireRedirectsAdmin()
  if ('error' in gate) return gate

  const id = String(formData.get('id') ?? '').trim()
  const enabled = String(formData.get('enabled') ?? '') === '1'

  const result = await updateRedirect({ id, enabled })
  if ('error' in result) return { error: result.error }

  await recordAdminAudit({
    actorId: gate.actorId,
    action: REDIRECT_UPDATE_ACTION,
    target: { type: 'redirect', id: result.redirect.id },
  })

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
  const gate = await requireRedirectsAdmin()
  if ('error' in gate) return gate

  const id = String(formData.get('id') ?? '').trim()
  const result = await deleteRedirect(id)
  if ('error' in result) return { error: result.error }

  await recordAdminAudit({
    actorId: gate.actorId,
    action: REDIRECT_DELETE_ACTION,
    target: { type: 'redirect', id },
  })

  revalidateRedirectPaths()
  return { ok: true, message: 'Redirect deleted.' }
}

export async function importRedirectsCsvAction(
  _prev: RedirectAdminActionState,
  formData: FormData,
): Promise<RedirectAdminActionState> {
  const gate = await requireRedirectsAdmin()
  if ('error' in gate) return gate

  const file = formData.get('file')
  if (!(file instanceof File) || file.size <= 0) {
    return { error: 'Choose a CSV file to import.' }
  }
  if (file.size > CSV_IMPORT_MAX_BYTES) {
    return { error: 'CSV file is too large (max 1 MB).' }
  }

  const text = await file.text()
  const result = await importRedirectsFromCsv(text)
  if ('error' in result) return { error: result.error }

  const { imported, skipped } = result
  const summary = `Imported ${imported}. Skipped ${skipped}.`

  if (imported === 0) {
    return { error: summary }
  }

  const importedAudit = redirectImportAudit(imported)
  if (importedAudit) {
    await recordAdminAudit({
      actorId: gate.actorId,
      action: importedAudit.action,
      target: importedAudit.target,
    })
  }

  revalidateRedirectPaths()
  return { ok: true, message: summary }
}
