'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireAppAdmin } from '@/core/auth/admin'
import { invalidateSiteSettings } from '@/core/content/revalidate'
import { DEFAULT_NAV_MENU_ID } from '@/core/db'

import {
  createNavMenuItem,
  cloneNavMenuItem,
  normalizeNavMenuDocument,
  normalizeNavMenuItem,
} from './document'
import {
  createNavMenu,
  deleteNavMenu,
  duplicateNavMenu,
  loadNavMenu,
  renameNavMenu,
  reorderNavMenuItem,
  replaceNavMenuItems,
} from './store'
import type { NavMenuItem } from './types'

export type NavActionState = {
  error?: string
  ok?: boolean
  message?: string
  menuId?: string
}

async function requireNavAdmin(): Promise<NavActionState | null> {
  const admin = await requireAppAdmin()
  if (!admin) {
    return { error: 'Sign in as a Starforge app admin to manage navigation.' }
  }
  return null
}

function revalidateNavPaths(menuId?: string) {
  invalidateSiteSettings()
  revalidatePath('/', 'layout')
  revalidatePath('/app/admin/nav')
  revalidatePath('/app/admin/settings')
  if (menuId) {
    revalidatePath(`/app/admin/nav/${encodeURIComponent(menuId)}`)
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

  revalidateNavPaths(result.menu.id)

  if (openAfter) {
    redirect(`/app/admin/nav/${encodeURIComponent(result.menu.id)}`)
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

  revalidateNavPaths(result.menu.id)
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

  revalidateNavPaths(result.menu.id)
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

  revalidateNavPaths()
  return { ok: true, message: `Menu “${id}” deleted.` }
}

function parseItemsFromForm(formData: FormData): NavMenuItem[] {
  const ids = formData.getAll('itemId').map((v) => String(v ?? ''))
  const labels = formData.getAll('itemLabel').map((v) => String(v ?? ''))
  const linkTypes = formData.getAll('itemLinkType').map((v) => String(v ?? ''))
  const pageIds = formData.getAll('itemPageId').map((v) => String(v ?? ''))
  const urls = formData.getAll('itemUrl').map((v) => String(v ?? ''))
  const parentIds = formData.getAll('itemParentId').map((v) => String(v ?? ''))
  const cssClasses = formData.getAll('itemCssClass').map((v) => String(v ?? ''))
  const browserTitles = formData.getAll('itemBrowserTitle').map((v) => String(v ?? ''))
  const pageHeadings = formData.getAll('itemPageHeading').map((v) => String(v ?? ''))
  const accessLevels = formData.getAll('itemAccessLevel').map((v) => String(v ?? ''))
  const accessGroupIds = formData.getAll('itemAccessGroupId').map((v) => String(v ?? ''))

  const count = Math.max(ids.length, labels.length)
  const items: NavMenuItem[] = []

  for (let i = 0; i < count; i++) {
    const label = (labels[i] ?? '').trim()
    if (!label) continue

    const accessRaw = (accessLevels[i] ?? 'public').trim()
    const groupId = (accessGroupIds[i] ?? '').trim()
    const accessLevel =
      accessRaw === 'group' && groupId
        ? `group:${groupId}`
        : accessRaw === 'group'
          ? 'public'
          : accessRaw || 'public'

    const normalized = normalizeNavMenuItem(
      {
        id: (ids[i] ?? '').trim() || undefined,
        label,
        linkType: linkTypes[i] === 'custom' ? 'custom' : 'page',
        pageId: pageIds[i] || null,
        url: urls[i] || null,
        parentId: (parentIds[i] ?? '').trim() || null,
        cssClass: cssClasses[i] || null,
        browserTitle: browserTitles[i] || null,
        pageHeading: pageHeadings[i] || null,
        accessLevel,
        sortOrder: i,
      },
      i,
    )
    if (normalized) items.push(normalized)
  }

  return normalizeNavMenuDocument({ version: 1, items }).items
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

  revalidateNavPaths(menuId)
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

  revalidateNavPaths(menuId)
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
  let items =
    formData.getAll('itemId').length > 0
      ? parseItemsFromForm(formData)
      : [...loaded.document.items]

  const label = String(formData.get('newLabel') ?? '').trim() || 'New item'
  const linkType = String(formData.get('newLinkType') ?? 'page') === 'custom' ? 'custom' : 'page'
  const pageIdRaw = String(formData.get('newPageId') ?? '').trim()
  const url = String(formData.get('newUrl') ?? '').trim() || '/'

  items.push(
    createNavMenuItem(
      {
        label,
        linkType,
        pageId: pageIdRaw ? Number(pageIdRaw) : null,
        url: linkType === 'custom' ? url : null,
        accessLevel: 'public',
      },
      items.length,
    ),
  )

  const result = await replaceNavMenuItems(menuId, items)
  if ('error' in result) return { error: result.error }

  revalidateNavPaths(menuId)
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

  let items =
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

  revalidateNavPaths(menuId)
  return { ok: true, message: 'Item pasted.', menuId }
}
