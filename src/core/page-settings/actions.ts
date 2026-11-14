'use server'

import { revalidatePath } from '@/core/content/defer-revalidate'

import {
  ensureDefaultUserGroupsSeeded,
  listUserGroupOptions,
} from '@/core/acl/groups'
import type { UserGroupOption } from '@/core/acl/types'
import { requireAppAdmin, userIsDeveloperAdmin } from '@/core/auth/admin'
import { GLOBAL_PAGE_CHROME_ID } from '@/core/db'
import { getSiteSettings, isAtomModuleEnabled } from '@/core/settings'
import { getActiveSkin, isSkinBaseOutlineId } from '@/core/skin'

import { ensureAtomsRegistered, getRegisteredAtom, listRegisteredAtoms } from './atoms'
import { DEFAULT_GLOBAL_PAGE_CHROME, newPageSettingsEntityId } from './defaults'
import {
  omitInheritedPageChromeKeys,
  parseInheritKeysJson,
} from './inherit-fields'
import { applyDeveloperAdminGate, normalizePageChrome } from './merge'
import { outlineChromeRowId } from './outline-chrome'
import {
  deleteOutlinePageChrome,
  loadGlobalPageChrome,
  loadOutlinePageChrome,
  savePageChrome,
} from './store'
import type { PageAtomInstance, PageChrome } from './types'

export type PageSettingsActionState = {
  error?: string
  ok?: boolean
  message?: string
}

function parseJsonField<T>(formData: FormData, key: string, fallback: T): T {
  const raw = formData.get(key)
  if (raw == null || String(raw).trim() === '') return fallback
  try {
    return JSON.parse(String(raw)) as T
  } catch {
    return fallback
  }
}

function parseCheckbox(formData: FormData, key: string): boolean {
  const raw = formData.get(key)
  if (raw == null) return false
  return String(raw) === 'true' || String(raw) === 'on' || String(raw) === '1'
}

/**
 * Build chrome from the Page Settings form.
 * `layoutId` is owned by nav menu assignment — never read from this form.
 */
function chromeFromFormData(formData: FormData): PageChrome {
  const atoms = parseJsonField<PageAtomInstance[]>(formData, 'atomsJson', [])
  const accessTags = parseJsonField<string[]>(formData, 'accessTagsJson', ['public'])
  return normalizePageChrome(
    {
      pageKey: null,
      sectionsLayout: String(formData.get('sectionsLayout') ?? '').trim() || undefined,
      accessTags,
      metaTags: parseJsonField(formData, 'metaTagsJson', []),
      customHeadHtml: String(formData.get('customHeadHtml') ?? ''),
      faviconUrl: String(formData.get('faviconUrl') ?? ''),
      touchIconUrl: String(formData.get('touchIconUrl') ?? ''),
      css: parseJsonField(formData, 'cssJson', []),
      javascript: parseJsonField(formData, 'javascriptJson', []),
      bodyId: String(formData.get('bodyId') ?? ''),
      bodyClasses: String(formData.get('bodyClasses') ?? ''),
      bodyTagAttributes: String(formData.get('bodyTagAttributes') ?? ''),
      afterBodyHtml: String(formData.get('afterBodyHtml') ?? ''),
      beforeBodyCloseHtml: String(formData.get('beforeBodyCloseHtml') ?? ''),
      fontAwesome: {
        enabled: parseCheckbox(formData, 'faEnabled'),
        v4Compat: parseCheckbox(formData, 'faV4Compat'),
        contentCompat: parseCheckbox(formData, 'faContentCompat'),
        version: String(formData.get('faVersion') ?? '6-free'),
        cssLinkHtml: String(formData.get('faCssLinkHtml') ?? ''),
        jsScriptHtml: String(formData.get('faJsScriptHtml') ?? ''),
      },
      atoms,
    },
    null,
  )
}

function revalidatePageSettingsPaths(outlineId?: string) {
  revalidatePath('/', 'layout')
  revalidatePath('/admin/page-settings')
  if (outlineId?.trim()) {
    revalidatePath(`/admin/page-settings?outline=${encodeURIComponent(outlineId.trim())}`)
  }
}

/** Save Page Settings for the toolbar outline (Base → global; else → outline:<id>). */
export async function savePageSettingsAction(
  _prev: PageSettingsActionState,
  formData: FormData,
): Promise<PageSettingsActionState> {
  const session = await requireAppAdmin()
  if (!session?.user) {
    return { error: 'Sign in as a Starforge app admin to edit Page Settings.' }
  }

  const outlineId = String(formData.get('outlineId') ?? '').trim()
  if (!outlineId) {
    return { error: 'Outline id is required.' }
  }

  const activeSkin = await getActiveSkin()
  const isBase = isSkinBaseOutlineId(outlineId, activeSkin.preferredDefaultOutlineId)
  const isDev = userIsDeveloperAdmin(session.user)

  if (isBase) {
    const prior = (await loadGlobalPageChrome()).chrome
    const incoming = chromeFromFormData(formData)
    const gated = applyDeveloperAdminGate(incoming, prior, isDev)
    const { layoutId: _ignored, ...gatedWithoutLayout } = gated

    try {
      await savePageChrome(GLOBAL_PAGE_CHROME_ID, {
        ...DEFAULT_GLOBAL_PAGE_CHROME,
        ...gatedWithoutLayout,
        pageKey: null,
        layoutId: undefined,
      })
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Could not save Page Settings.'
      return { error: message }
    }

    revalidatePageSettingsPaths(outlineId)
    return {
      ok: true,
      message: isDev
        ? 'Base Page Settings saved.'
        : 'Base Page Settings saved (script fields unchanged — developer-admin only).',
    }
  }

  const priorResult = await loadOutlinePageChrome(outlineId)
  const prior = priorResult.isFallback ? null : priorResult.chrome
  const incoming = chromeFromFormData(formData)
  const gated = applyDeveloperAdminGate(incoming, prior, isDev)
  const inheritKeys = parseInheritKeysJson(formData.get('inheritKeysJson'))
  const sparse = omitInheritedPageChromeKeys(
    { ...gated, pageKey: null, layoutId: undefined },
    inheritKeys,
  )
  const { layoutId: _drop, ...toSave } = sparse

  try {
    const hasLocal = Object.keys(toSave).some((k) => k !== 'pageKey' && toSave[k as keyof PageChrome] !== undefined)
    if (!hasLocal) {
      await deleteOutlinePageChrome(outlineId)
    } else {
      await savePageChrome(outlineChromeRowId(outlineId), toSave)
    }
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Could not save outline Page Settings.'
    return { error: message }
  }

  revalidatePageSettingsPaths(outlineId)
  return {
    ok: true,
    message: isDev
      ? `Page Settings saved for outline “${outlineId}”.`
      : `Page Settings saved for outline “${outlineId}” (script fields unchanged — developer-admin only).`,
  }
}

/** @deprecated Prefer savePageSettingsAction — kept for older imports. */
export const saveGlobalPageSettingsAction = savePageSettingsAction

export type PageSettingsAdminBootstrap = {
  outlineId: string
  /** Active skin Base shell — Inherit/Copy hidden. */
  isBaseOutline: boolean
  /** Show field Inherit/Copy (non-Base outlines). */
  canInherit: boolean
  /** Base chrome source (`global`). */
  baseChrome: PageChrome
  /** Editing chrome (Base = full global; child = sparse outline row). */
  editingChrome: PageChrome
  /** Users → Groups for page viewing tags. */
  groups: UserGroupOption[]
  atoms: Array<{
    type: string
    label: string
    description?: string
    requiresDeveloperAdmin?: boolean
    defaultConfig: Record<string, unknown>
  }>
  isDeveloperAdmin: boolean
}

/** Admin page data loader — scoped to toolbar outline. */
export async function loadPageSettingsAdmin(
  outlineId: string,
): Promise<PageSettingsAdminBootstrap> {
  const session = await requireAppAdmin()
  const isDev = userIsDeveloperAdmin(session?.user)
  const outline = outlineId.trim()
  if (!outline) {
    throw new Error('Outline id is required for Page Settings.')
  }

  await ensureAtomsRegistered()
  await ensureDefaultUserGroupsSeeded()

  const activeSkin = await getActiveSkin()
  const isBase = isSkinBaseOutlineId(outline, activeSkin.preferredDefaultOutlineId)

  const [globalResult, groups] = await Promise.all([
    loadGlobalPageChrome(),
    listUserGroupOptions(),
  ])
  const baseChrome = globalResult.chrome

  let editingChrome: PageChrome = { ...baseChrome, pageKey: null }
  if (!isBase) {
    const outlineRow = await loadOutlinePageChrome(outline)
    editingChrome = outlineRow.isFallback
      ? { pageKey: null }
      : { ...outlineRow.chrome, pageKey: null, layoutId: undefined }
  }

  const settingsSite = await getSiteSettings()

  return {
    outlineId: outline,
    isBaseOutline: isBase,
    canInherit: !isBase,
    baseChrome,
    editingChrome,
    groups,
    atoms: listRegisteredAtoms()
      .filter((a) => isAtomModuleEnabled(settingsSite, a.type))
      .map((a) => ({
        type: a.type,
        label: a.label,
        description: a.description,
        requiresDeveloperAdmin: a.requiresDeveloperAdmin,
        defaultConfig: a.defaultConfig(),
      })),
    isDeveloperAdmin: isDev,
  }
}

export async function createAtomInstanceAction(
  type: string,
): Promise<{ ok: true; atom: PageAtomInstance } | { ok: false; error: string }> {
  const session = await requireAppAdmin()
  if (!session?.user) return { ok: false, error: 'Admins only.' }

  await ensureAtomsRegistered()
  const def = getRegisteredAtom(type)
  if (!def) return { ok: false, error: `Unknown atom type “${type}”.` }
  const settings = await getSiteSettings()
  if (!isAtomModuleEnabled(settings, type)) {
    return { ok: false, error: `Atom “${type}” is disabled in Settings → Modules.` }
  }
  if (def.requiresDeveloperAdmin && !userIsDeveloperAdmin(session.user)) {
    return { ok: false, error: 'This atom requires developer-admin.' }
  }

  return {
    ok: true,
    atom: {
      id: newPageSettingsEntityId(`atom-${type}`),
      type: def.type,
      enabled: true,
      config: def.defaultConfig(),
    },
  }
}
