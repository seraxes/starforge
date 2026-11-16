'use server'

import { normalizeLocaleTextMap } from '@/core/i18n/locale-text'
import { recordCurrentAdminActivity } from '@/core/audit'

import { requirePagesEditor } from './access'
import {
  createPageTag,
  deletePage,
  deletePageTag,
  renamePageTag,
  restorePageVersion,
  savePage,
} from './store'
import { isPageStatus, type PagesAdminActionState } from './types'

export type { PagesAdminActionState }

function localeMap(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? '').trim()
  if (!raw) return undefined
  try {
    return normalizeLocaleTextMap(JSON.parse(raw) as unknown)
  } catch {
    return undefined
  }
}

export async function savePageAction(
  _prev: PagesAdminActionState,
  formData: FormData,
): Promise<PagesAdminActionState> {
  const gate = await requirePagesEditor()
  if ('error' in gate) return { error: gate.error }

  const intent = String(formData.get('intent') ?? 'draft')
  const status = intent === 'publish' ? 'published' : 'draft'
  if (!isPageStatus(status)) return { error: 'Unknown save action.' }

  const saved = await savePage({
    id: String(formData.get('id') ?? ''),
    slug: String(formData.get('slug') ?? ''),
    status,
    title: String(formData.get('title') ?? ''),
    body: String(formData.get('body') ?? ''),
    metaTitle: String(formData.get('metaTitle') ?? ''),
    metaDescription: String(formData.get('metaDescription') ?? ''),
    metaMediaId: String(formData.get('metaMediaId') ?? ''),
    tags: String(formData.get('tags') ?? ''),
    titleLocales: localeMap(formData, 'titleLocales'),
    bodyLocales: localeMap(formData, 'bodyLocales'),
    metaTitleLocales: localeMap(formData, 'metaTitleLocales'),
    metaDescriptionLocales: localeMap(formData, 'metaDescriptionLocales'),
  })
  if ('error' in saved) return { error: saved.error }
  await recordCurrentAdminActivity(status === 'published' ? 'page.publish' : 'page.save', {
    type: 'page',
    id: saved.page.id,
  })
  return {
    ok: true,
    id: saved.page.id,
    message: status === 'published' ? 'Published.' : 'Draft saved.',
  }
}

export async function restorePageVersionAction(
  _prev: PagesAdminActionState,
  formData: FormData,
): Promise<PagesAdminActionState> {
  const gate = await requirePagesEditor('manage')
  if ('error' in gate) return { error: gate.error }
  const restored = await restorePageVersion(
    String(formData.get('pageId') ?? ''),
    String(formData.get('versionId') ?? ''),
  )
  if ('error' in restored) return { error: restored.error }
  await recordCurrentAdminActivity('page.restore', {
    type: 'page',
    id: restored.page.id,
  })
  return { ok: true, id: restored.page.id, message: 'Version restored.' }
}

export async function createPageTagAction(
  _prev: PagesAdminActionState,
  formData: FormData,
): Promise<PagesAdminActionState> {
  const gate = await requirePagesEditor()
  if ('error' in gate) return { error: gate.error }
  const created = await createPageTag(String(formData.get('title') ?? ''))
  if ('error' in created) return { error: created.error }
  return { ok: true, id: created.tag.id, message: 'Tag saved.' }
}

export async function renamePageTagAction(
  _prev: PagesAdminActionState,
  formData: FormData,
): Promise<PagesAdminActionState> {
  const gate = await requirePagesEditor()
  if ('error' in gate) return { error: gate.error }
  const renamed = await renamePageTag(
    String(formData.get('id') ?? ''),
    String(formData.get('title') ?? ''),
  )
  if ('error' in renamed) return { error: renamed.error }
  return { ok: true, id: renamed.tag.id, message: 'Tag renamed.' }
}

export async function deletePageTagAction(
  _prev: PagesAdminActionState,
  formData: FormData,
): Promise<PagesAdminActionState> {
  const gate = await requirePagesEditor('manage')
  if ('error' in gate) return { error: gate.error }
  const deleted = await deletePageTag(String(formData.get('id') ?? ''))
  if ('error' in deleted) return { error: deleted.error }
  return { ok: true, deleted: true, message: 'Tag deleted.' }
}

export async function deletePageAction(
  _prev: PagesAdminActionState,
  formData: FormData,
): Promise<PagesAdminActionState> {
  const gate = await requirePagesEditor('manage')
  if ('error' in gate) return { error: gate.error }
  const result = await deletePage(String(formData.get('id') ?? ''))
  if ('error' in result) return { error: result.error }
  await recordCurrentAdminActivity('page.delete', {
    type: 'page',
    id: String(formData.get('id') ?? '').trim(),
  })
  return { ok: true, deleted: true, message: 'Page deleted.' }
}
