'use server'

import { revalidatePath } from '@/core/content/defer-revalidate'

import { requireAdminArea } from '@/core/acl/access'
import { MODULE_IDS, getSiteSettingsLive, isCatalogModuleEnabled } from '@/core/settings'

import { createDocumentTemplate, updateDocumentTemplate } from './templates-store'

export type DocumentsAdminActionState = {
  error?: string
  ok?: boolean
  message?: string
}

async function requireDocumentsStaff(): Promise<DocumentsAdminActionState | null> {
  const session = await requireAdminArea('admin.documents', 'edit')
  if (!session) {
    return {
      error:
        'Sign in with Documents admin access (app admin or ACL → Documents edit) to manage templates.',
    }
  }
  const settings = await getSiteSettingsLive()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.documents)) {
    return { error: 'Documents is disabled. Enable it under Settings → Modules.' }
  }
  return null
}

function revalidateDocumentsAdmin() {
  revalidatePath('/admin/documents')
}

function readTemplateForm(formData: FormData) {
  return {
    id: String(formData.get('id') ?? ''),
    title: String(formData.get('title') ?? ''),
    subjectKind: String(formData.get('subjectKind') ?? ''),
    renderSource: String(formData.get('renderSource') ?? ''),
    enabled: formData.get('enabled') === '1',
  }
}

export async function createDocumentTemplateAction(
  _prev: DocumentsAdminActionState,
  formData: FormData,
): Promise<DocumentsAdminActionState> {
  const denied = await requireDocumentsStaff()
  if (denied) return denied

  const result = await createDocumentTemplate(readTemplateForm(formData))
  if (!result.ok) return { error: result.error }
  revalidateDocumentsAdmin()
  return { ok: true, message: 'Template created.' }
}

export async function updateDocumentTemplateAction(
  _prev: DocumentsAdminActionState,
  formData: FormData,
): Promise<DocumentsAdminActionState> {
  const denied = await requireDocumentsStaff()
  if (denied) return denied

  const result = await updateDocumentTemplate(readTemplateForm(formData))
  if (!result.ok) return { error: result.error }
  revalidateDocumentsAdmin()
  return { ok: true, message: 'Template saved.' }
}
