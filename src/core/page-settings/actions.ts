'use server'

import { revalidatePath } from 'next/cache'

import {
  ensureDefaultUserGroupsSeeded,
  listUserGroupOptions,
} from '@/core/acl/groups'
import type { UserGroupOption } from '@/core/acl/types'
import { requireAppAdmin, userIsDeveloperAdmin } from '@/core/auth/admin'
import { GLOBAL_PAGE_CHROME_ID } from '@/core/db'
import { listLayoutOutlines } from '@/core/modules/layout-store'
import { getSiteSettings, isAtomModuleEnabled } from '@/core/settings'
import { getPayload } from 'payload'
import config from '@payload-config'

import { ensureAtomsRegistered, getRegisteredAtom, listRegisteredAtoms } from './atoms'
import { DEFAULT_GLOBAL_PAGE_CHROME, newPageSettingsEntityId } from './defaults'
import { applyDeveloperAdminGate, normalizePageChrome } from './merge'
import {
  deletePageChromeOverride,
  listPageChromeOverrideKeys,
  loadGlobalPageChrome,
  loadPageChromeOverride,
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

function chromeFromFormData(formData: FormData, pageKey: string | null): PageChrome {
  const atoms = parseJsonField<PageAtomInstance[]>(formData, 'atomsJson', [])
  const accessTags = parseJsonField<string[]>(formData, 'accessTagsJson', ['public'])
  return normalizePageChrome(
    {
      pageKey,
      layoutId: String(formData.get('layoutId') ?? '').trim() || undefined,
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
    pageKey,
  )
}

function revalidatePageSettingsPaths(pageKey: string | null) {
  revalidatePath('/', 'layout')
  revalidatePath('/app/admin/page-settings')
  if (pageKey && pageKey !== 'home') {
    revalidatePath(`/${pageKey}`)
  }
  if (pageKey === 'home') {
    revalidatePath('/')
  }
}

export async function saveGlobalPageSettingsAction(
  _prev: PageSettingsActionState,
  formData: FormData,
): Promise<PageSettingsActionState> {
  const session = await requireAppAdmin()
  if (!session?.user) {
    return { error: 'Sign in as a Starforge app admin to edit Page Settings.' }
  }

  const isDev = userIsDeveloperAdmin(session.user)
  const prior = (await loadGlobalPageChrome()).chrome
  const incoming = chromeFromFormData(formData, null)
  const gated = applyDeveloperAdminGate(incoming, prior, isDev)

  try {
    await savePageChrome(GLOBAL_PAGE_CHROME_ID, {
      ...DEFAULT_GLOBAL_PAGE_CHROME,
      ...gated,
      pageKey: null,
    })
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Could not save global Page Settings.'
    return { error: message }
  }

  revalidatePageSettingsPaths(null)
  return {
    ok: true,
    message: isDev
      ? 'Site Page Settings saved.'
      : 'Site Page Settings saved (script fields unchanged — developer-admin only).',
  }
}

export async function savePageOverrideAction(
  _prev: PageSettingsActionState,
  formData: FormData,
): Promise<PageSettingsActionState> {
  const session = await requireAppAdmin()
  if (!session?.user) {
    return { error: 'Sign in as a Starforge app admin to edit Page Settings.' }
  }

  const pageKey = String(formData.get('pageKey') ?? '').trim()
  if (!pageKey || pageKey === GLOBAL_PAGE_CHROME_ID) {
    return { error: 'Choose a page (slug or home) for the override.' }
  }

  const isDev = userIsDeveloperAdmin(session.user)
  const priorResult = await loadPageChromeOverride(pageKey)
  const prior = priorResult.isFallback ? null : priorResult.chrome
  const incoming = chromeFromFormData(formData, pageKey)
  const gated = applyDeveloperAdminGate(incoming, prior, isDev)

  try {
    await savePageChrome(pageKey, { ...gated, pageKey })
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Could not save page override.'
    return { error: message }
  }

  revalidatePageSettingsPaths(pageKey)
  return { ok: true, message: `Override saved for “${pageKey}”.` }
}

export async function clearPageOverrideAction(
  _prev: PageSettingsActionState,
  formData: FormData,
): Promise<PageSettingsActionState> {
  const session = await requireAppAdmin()
  if (!session?.user) {
    return { error: 'Sign in as a Starforge app admin to edit Page Settings.' }
  }

  const pageKey = String(formData.get('pageKey') ?? '').trim()
  if (!pageKey) return { error: 'Missing pageKey.' }

  await deletePageChromeOverride(pageKey)
  revalidatePageSettingsPaths(pageKey)
  return { ok: true, message: `Cleared override for “${pageKey}” (inherits site defaults).` }
}

export type PageSettingsAdminBootstrap = {
  globalChrome: PageChrome
  overrideKeys: string[]
  pages: Array<{ slug: string; title: string }>
  /** All layout outlines (`sf_layouts`) for Layout assignment. */
  layouts: Array<{ id: string; label: string }>
  /** @deprecated Prefer `layouts` — kept for older form code paths. */
  layoutIds: string[]
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
  editingPageKey: string | null
  editingChrome: PageChrome
  hasOverride: boolean
}

/** Admin page data loader. */
export async function loadPageSettingsAdmin(editingPageKey: string | null): Promise<PageSettingsAdminBootstrap> {
  const session = await requireAppAdmin()
  const isDev = userIsDeveloperAdmin(session?.user)

  ensureAtomsRegistered()
  await ensureDefaultUserGroupsSeeded()
  const [globalResult, overrideKeys, groups] = await Promise.all([
    loadGlobalPageChrome(),
    listPageChromeOverrideKeys(),
    listUserGroupOptions(),
  ])
  const globalChrome = globalResult.chrome

  let pages: Array<{ slug: string; title: string }> = []
  try {
    const payload = await getPayload({ config })
    const result = await payload.find({
      collection: 'pages',
      limit: 100,
      depth: 0,
      overrideAccess: true,
      sort: 'title',
    })
    pages = result.docs
      .map((doc) => ({
        slug: typeof doc.slug === 'string' ? doc.slug : '',
        title: typeof doc.title === 'string' ? doc.title : '',
      }))
      .filter((p) => p.slug)
  } catch {
    pages = []
  }

  const outlines = await listLayoutOutlines()
  const layouts = outlines.map((o) => ({ id: o.id, label: o.label }))
  const layoutIds = layouts.map((l) => l.id)

  let editingChrome: PageChrome = { ...globalChrome, pageKey: null }
  let hasOverride = false
  if (editingPageKey) {
    const override = await loadPageChromeOverride(editingPageKey)
    hasOverride = !override.isFallback
    editingChrome = hasOverride
      ? override.chrome
      : { pageKey: editingPageKey }
  }

  const settingsSite = await getSiteSettings()

  return {
    globalChrome,
    overrideKeys,
    pages,
    layouts,
    layoutIds,
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
    editingPageKey,
    editingChrome,
    hasOverride,
  }
}

export async function createAtomInstanceAction(
  type: string,
): Promise<{ ok: true; atom: PageAtomInstance } | { ok: false; error: string }> {
  const session = await requireAppAdmin()
  if (!session?.user) return { ok: false, error: 'Admins only.' }

  ensureAtomsRegistered()
  const def = getRegisteredAtom(type)
  if (!def) return { ok: false, error: `Unknown atom type “${type}”.` }
  const settings = await getSiteSettings()
  if (!isAtomModuleEnabled(settings, type)) {
    return { ok: false, error: `Atom “${type}” is disabled in Site Settings → Modules.` }
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
