'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireAdminArea, type AclAdminResourceKey } from '@/core/acl'
import { invalidateNavMenu } from '@/core/content/revalidate'
import { DEFAULT_NAV_MENU_ID } from '@/core/db'
import { normalizeLocaleTextMap } from '@/core/i18n/locale-text'

import {
  createNavMenuItem,
  cloneNavMenuItem,
  normalizeNavMenuDocument,
  normalizeNavMenuItem,
} from './document'
import { listEnabledModuleNavOptions } from './module-views'
import {
  listNavOutlineAssignmentTree,
  setNavItemOutlineAssignment,
  syncNavMenuOutlinesToPageChrome,
} from './outline-assign'
import type { NavOutlineAssignmentMenu } from './types'
import {
  createNavMenu,
  deleteNavMenu,
  duplicateNavMenu,
  listNavPageOptions,
  loadNavMenu,
  renameNavMenu,
  reorderNavMenuItem,
  replaceNavMenuItems,
} from './store'
import { getPreferredLayoutId } from '@/core/skin/preferred-outline'
import { getSiteSettings } from '@/core/settings'
import type { NavMenuItem } from './types'

export type NavActionState = {
  error?: string
  ok?: boolean
  message?: string
  menuId?: string
}

async function requireNavAdmin(): Promise<NavActionState | null> {
  const session = await requireAdminArea('admin.nav')
  if (!session) {
    return {
      error:
        'Sign in with Navigation ACL (Users → ACL → admin.nav) or as a Starforge app admin.',
    }
  }
  return null
}

/** Layouts chrome may edit outline↔menu assignment with layouts or nav ACL. */
async function requireOutlineAssignAdmin(): Promise<NavActionState | null> {
  const keys: AclAdminResourceKey[] = ['admin.layouts', 'admin.nav']
  for (const key of keys) {
    const session = await requireAdminArea(key)
    if (session) return null
  }
  return {
    error:
      'Sign in with Layouts or Navigation ACL (Users → ACL) or as a Starforge app admin.',
  }
}

async function revalidateNavPaths(menuId?: string) {
  await invalidateNavMenu(menuId)
  revalidatePath('/', 'layout')
  revalidatePath('/admin/nav')
  revalidatePath('/admin/settings')
  if (menuId) {
    revalidatePath(`/admin/nav/${encodeURIComponent(menuId)}`)
  }
}

export async function createNavMenuAction(
  _prev: NavActionState,
  formData: FormData,
): Promise<NavActionState> {
  const denied = await requireNavAdmin()
  if (denied) return denied

  const label = String(formData.get('label') ?? '').trim()
  const requestedId = String(formData.get('id') ?? '').trim()
  const copyFromId = String(formData.get('copyFromId') ?? '').trim()
  const openAfter = String(formData.get('openAfter') ?? '') === '1'

  const result = await createNavMenu({
    label,
    ...(requestedId ? { id: requestedId } : {}),
    ...(copyFromId ? { copyFromId } : {}),
  })

  if ('error' in result) return { error: result.error }

  await revalidateNavPaths(result.menu.id)

  if (openAfter) {
    redirect(`/admin/nav/${encodeURIComponent(result.menu.id)}`)
  }

  return {
    ok: true,
    message: `Menu “${result.menu.label}” created.`,
    menuId: result.menu.id,
  }
}

export async function renameNavMenuAction(
  _prev: NavActionState,
  formData: FormData,
): Promise<NavActionState> {
  const denied = await requireNavAdmin()
  if (denied) return denied

  const id = String(formData.get('id') ?? '').trim()
  const label = String(formData.get('label') ?? '').trim()
  const result = await renameNavMenu({ id, label })
  if ('error' in result) return { error: result.error }

  await revalidateNavPaths(result.menu.id)
  return {
    ok: true,
    message: `Renamed to “${result.menu.label}”.`,
    menuId: result.menu.id,
  }
}

export async function duplicateNavMenuAction(
  _prev: NavActionState,
  formData: FormData,
): Promise<NavActionState> {
  const denied = await requireNavAdmin()
  if (denied) return denied

  const id = String(formData.get('id') ?? '').trim()
  const label = String(formData.get('label') ?? '').trim()
  const result = await duplicateNavMenu({
    id,
    ...(label ? { label } : {}),
  })
  if ('error' in result) return { error: result.error }

  await revalidateNavPaths(result.menu.id)
  return {
    ok: true,
    message: `Duplicated as “${result.menu.label}”.`,
    menuId: result.menu.id,
  }
}

export async function deleteNavMenuAction(
  _prev: NavActionState,
  formData: FormData,
): Promise<NavActionState> {
  const denied = await requireNavAdmin()
  if (denied) return denied

  const id = String(formData.get('id') ?? '').trim()
  if (id === DEFAULT_NAV_MENU_ID) {
    return { error: 'The default Main menu cannot be deleted.' }
  }

  const result = await deleteNavMenu(id)
  if ('error' in result) return { error: result.error }

  await revalidateNavPaths()
  return { ok: true, message: `Menu “${id}” deleted.` }
}

function localeMapFromField(raw: string): Record<string, string> | undefined {
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  try {
    const map = normalizeLocaleTextMap(JSON.parse(trimmed) as unknown)
    return Object.keys(map).length > 0 ? map : undefined
  } catch {
    return undefined
  }
}

function parseItemsFromForm(formData: FormData): NavMenuItem[] {
  const ids = formData.getAll('itemId').map((v) => String(v ?? ''))
  const labels = formData.getAll('itemLabel').map((v) => String(v ?? ''))
  const linkTypes = formData.getAll('itemLinkType').map((v) => String(v ?? ''))
  const pageIds = formData.getAll('itemPageId').map((v) => String(v ?? ''))
  const urls = formData.getAll('itemUrl').map((v) => String(v ?? ''))
  const moduleIds = formData.getAll('itemModuleId').map((v) => String(v ?? ''))
  const moduleViewKeys = formData.getAll('itemModuleViewKey').map((v) => String(v ?? ''))
  const parentIds = formData.getAll('itemParentId').map((v) => String(v ?? ''))
  const cssClasses = formData.getAll('itemCssClass').map((v) => String(v ?? ''))
  const browserTitles = formData.getAll('itemBrowserTitle').map((v) => String(v ?? ''))
  const pageHeadings = formData.getAll('itemPageHeading').map((v) => String(v ?? ''))
  const labelsJson = formData.getAll('itemLabels').map((v) => String(v ?? ''))
  const browserTitlesJson = formData.getAll('itemBrowserTitles').map((v) => String(v ?? ''))
  const pageHeadingsJson = formData.getAll('itemPageHeadings').map((v) => String(v ?? ''))
  const layoutIds = formData.getAll('itemLayoutId').map((v) => String(v ?? ''))
  // One JSON array string per item (multi-select access tags).
  const accessTagsRaw = formData.getAll('itemAccessTags').map((v) => String(v ?? ''))

  const count = Math.max(ids.length, labels.length)
  const items: NavMenuItem[] = []

  for (let i = 0; i < count; i++) {
    const label = (labels[i] ?? '').trim()
    if (!label) continue

    let accessTags: unknown = ['public']
    const tagsField = (accessTagsRaw[i] ?? '').trim()
    if (tagsField) {
      try {
        accessTags = JSON.parse(tagsField) as unknown
      } catch {
        accessTags = tagsField.split(/[,|]/).map((t) => t.trim()).filter(Boolean)
      }
    }

    const rawType = (linkTypes[i] ?? 'page').trim()
    const linkType =
      rawType === 'module' ? 'module' : rawType === 'url' || rawType === 'custom' ? 'url' : 'page'

    const normalized = normalizeNavMenuItem(
      {
        id: (ids[i] ?? '').trim() || undefined,
        label,
        linkType,
        pageId: pageIds[i] || null,
        url: urls[i] || null,
        moduleId: moduleIds[i] || null,
        moduleViewKey: moduleViewKeys[i] || null,
        parentId: (parentIds[i] ?? '').trim() || null,
        cssClass: cssClasses[i] || null,
        browserTitle: browserTitles[i] || null,
        browserTitles: localeMapFromField(browserTitlesJson[i] ?? ''),
        pageHeading: pageHeadings[i] || null,
        pageHeadings: localeMapFromField(pageHeadingsJson[i] ?? ''),
        labels: localeMapFromField(labelsJson[i] ?? ''),
        layoutId: (layoutIds[i] ?? '').trim() || null,
        accessTags,
        sortOrder: i,
      },
      i,
    )
    if (normalized) items.push(normalized)
  }

  return normalizeNavMenuDocument({ version: 1, items }).items
}

async function syncOutlinesAfterSave(items: NavMenuItem[]): Promise<void> {
  try {
    const settings = await getSiteSettings()
    const [pages, modules] = await Promise.all([
      listNavPageOptions(),
      Promise.resolve(listEnabledModuleNavOptions(settings)),
    ])
    await syncNavMenuOutlinesToPageChrome(items, pages, modules)
  } catch {
    // Page Settings / Payload may be unavailable — nav save still succeeds.
  }
}

export async function saveNavMenuItemsAction(
  _prev: NavActionState,
  formData: FormData,
): Promise<NavActionState> {
  const denied = await requireNavAdmin()
  if (denied) return denied

  const menuId = String(formData.get('menuId') ?? '').trim()
  if (!menuId) return { error: 'Menu id is required.' }

  const items = parseItemsFromForm(formData)
  const result = await replaceNavMenuItems(menuId, items)
  if ('error' in result) return { error: result.error }

  await syncOutlinesAfterSave(result.document.items)
  await revalidateNavPaths(menuId)
  revalidatePath('/admin/page-settings')
  return {
    ok: true,
    message: `Saved ${result.document.items.length} item${result.document.items.length === 1 ? '' : 's'}.`,
    menuId,
  }
}

export async function moveNavMenuItemAction(
  _prev: NavActionState,
  formData: FormData,
): Promise<NavActionState> {
  const denied = await requireNavAdmin()
  if (denied) return denied

  const menuId = String(formData.get('menuId') ?? '').trim()
  const itemId = String(
    formData.get('moveItemId') ?? formData.get('itemId') ?? '',
  ).trim()
  const direction = String(formData.get('direction') ?? '').trim()
  if (!menuId || !itemId) return { error: 'Menu and item are required.' }
  const delta: -1 | 1 = direction === 'down' ? 1 : -1

  // Persist any in-form edits first when present
  if (formData.getAll('itemLabel').length > 0) {
    const items = parseItemsFromForm(formData)
    const saved = await replaceNavMenuItems(menuId, items)
    if ('error' in saved) return { error: saved.error }
  }

  const result = await reorderNavMenuItem(menuId, itemId, delta)
  if ('error' in result) return { error: result.error }

  await revalidateNavPaths(menuId)
  return { ok: true, message: 'Order updated.', menuId }
}

export async function addNavMenuItemAction(
  _prev: NavActionState,
  formData: FormData,
): Promise<NavActionState> {
  const denied = await requireNavAdmin()
  if (denied) return denied

  const menuId = String(formData.get('menuId') ?? '').trim()
  if (!menuId) return { error: 'Menu id is required.' }

  const loaded = await loadNavMenu(menuId)
  if (loaded.isFallback && loaded.source === 'empty') {
    return { error: `Menu “${menuId}” was not found.` }
  }

  // Prefer current form rows when the editor submitted them alongside Add
  const items =
    formData.getAll('itemId').length > 0
      ? parseItemsFromForm(formData)
      : [...loaded.document.items]

  const label = String(formData.get('newLabel') ?? '').trim() || 'New item'
  const rawType = String(formData.get('newLinkType') ?? 'page').trim()
  const linkType =
    rawType === 'module' ? 'module' : rawType === 'url' || rawType === 'custom' ? 'url' : 'page'
  const pageIdRaw = String(formData.get('newPageId') ?? '').trim()
  const url = String(formData.get('newUrl') ?? '').trim() || '/'
  const moduleId = String(formData.get('newModuleId') ?? '').trim()
  const moduleViewKey = String(formData.get('newModuleViewKey') ?? '').trim()
  const layoutIdRaw = String(formData.get('newLayoutId') ?? '').trim()
  const preferredLayoutId = await getPreferredLayoutId()

  items.push(
    createNavMenuItem(
      {
        label,
        linkType,
        pageId: pageIdRaw ? Number(pageIdRaw) : null,
        url: linkType === 'url' ? url : null,
        moduleId: linkType === 'module' ? moduleId || null : null,
        moduleViewKey: linkType === 'module' ? moduleViewKey || null : null,
        layoutId: layoutIdRaw || preferredLayoutId,
        accessTags: ['public'],
      },
      items.length,
    ),
  )

  const result = await replaceNavMenuItems(menuId, items)
  if ('error' in result) return { error: result.error }

  await syncOutlinesAfterSave(result.document.items)
  await revalidateNavPaths(menuId)
  revalidatePath('/admin/page-settings')
  return { ok: true, message: 'Item added.', menuId }
}

export async function pasteNavMenuItemAction(
  _prev: NavActionState,
  formData: FormData,
): Promise<NavActionState> {
  const denied = await requireNavAdmin()
  if (denied) return denied

  const menuId = String(formData.get('menuId') ?? '').trim()
  const clipboardJson = String(formData.get('clipboardJson') ?? '').trim()
  if (!menuId) return { error: 'Menu id is required.' }
  if (!clipboardJson) return { error: 'Clipboard is empty — copy an item first.' }

  let parsed: unknown
  try {
    parsed = JSON.parse(clipboardJson)
  } catch {
    return { error: 'Clipboard data is not valid JSON.' }
  }

  const clonedSource = normalizeNavMenuItem(parsed, 0)
  if (!clonedSource) return { error: 'Clipboard does not contain a nav item.' }

  const loaded = await loadNavMenu(menuId)
  if (loaded.isFallback && loaded.source === 'empty') {
    return { error: `Menu “${menuId}” was not found.` }
  }

  const items =
    formData.getAll('itemId').length > 0
      ? parseItemsFromForm(formData)
      : [...loaded.document.items]

  items.push(
    cloneNavMenuItem(clonedSource, {
      labelSuffix: ' (copy)',
      sortOrder: items.length,
    }),
  )

  const result = await replaceNavMenuItems(menuId, items)
  if ('error' in result) return { error: result.error }

  await syncOutlinesAfterSave(result.document.items)
  await revalidateNavPaths(menuId)
  revalidatePath('/admin/page-settings')
  return { ok: true, message: 'Item pasted.', menuId }
}

/** Layouts chrome — load Menu → item assignment tree for the active outline. */
export async function listNavOutlineAssignmentsAction(
  outlineId: string,
): Promise<{ menus: NavOutlineAssignmentMenu[] } | { error: string }> {
  const denied = await requireOutlineAssignAdmin()
  if (denied) return { error: denied.error || 'Not allowed.' }

  const outline = outlineId.trim()
  if (!outline) return { error: 'Outline id is required.' }

  try {
    const menus = await listNavOutlineAssignmentTree(outline)
    return { menus }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not load menu assignments.',
    }
  }
}

/** Layouts chrome — toggle outline assignment on one nav item. */
export async function toggleNavItemOutlineAssignmentAction(input: {
  menuId: string
  itemId: string
  outlineId: string
  assigned: boolean
}): Promise<NavActionState> {
  const denied = await requireOutlineAssignAdmin()
  if (denied) return denied

  const result = await setNavItemOutlineAssignment(input)
  if ('error' in result) return { error: result.error }

  await revalidateNavPaths(input.menuId.trim())
  revalidatePath('/admin/layouts')
  revalidatePath('/admin/breakpoints')
  revalidatePath('/admin/page-settings')
  revalidatePath('/admin/assigned-menu')
  revalidatePath('/admin/outlines')
  if (input.outlineId.trim()) {
    revalidatePath(`/admin/layouts?outline=${encodeURIComponent(input.outlineId.trim())}`)
    revalidatePath(`/admin/assigned-menu?outline=${encodeURIComponent(input.outlineId.trim())}`)
  }

  return {
    ok: true,
    message: input.assigned ? 'Outline assigned to menu item.' : 'Outline removed from menu item.',
    menuId: input.menuId.trim(),
  }
}
