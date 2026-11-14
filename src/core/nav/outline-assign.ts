/**
 * Nav outline assignment (Menus / Assigned Menu).
 * Nav owns `layoutId` on items; Page Settings chrome is a sync mirror only
 * (Page Settings UI does not edit layoutId).
 */
import 'server-only'

import { pageKeyFromPathname } from '@/core/page-settings/resolve'
import { HOME_PAGE_KEY } from '@/core/page-settings/defaults'
import {
  deletePageChromeOverride,
  loadPageChromeOverride,
  savePageChrome,
} from '@/core/page-settings/store'
import { invalidatePageChrome } from '@/core/content/revalidate'
import { listLayoutOutlines, resolveExistingLayoutId } from '@/core/modules/layout-store'

import { flattenNavItemsInOrder } from './document'
import { listEnabledModuleNavOptions } from './module-views'
import { listNavMenus, listNavPageOptions, loadNavMenu, replaceNavMenuItems } from './store'
import { getSiteSettings } from '@/core/settings'
import type {
  NavMenuItem,
  NavModuleOption,
  NavOutlineAssignmentMenu,
  NavPageOption,
} from './types'

export type { NavOutlineAssignmentItem, NavOutlineAssignmentMenu } from './types'

/** Map a nav item to a Page Settings pageKey (null when not assignable). */
export function pageKeyForNavItem(
  item: NavMenuItem,
  pages: NavPageOption[],
  modules: NavModuleOption[],
): string | null {
  if (item.linkType === 'admin') {
    return null
  }
  if (item.linkType === 'page') {
    const page = pages.find((p) => p.id === item.pageId)
    if (!page?.slug) return null
    const slug = page.slug.trim().replace(/^\/+|\/+$/g, '')
    if (!slug || slug === 'home') return HOME_PAGE_KEY
    return slug.split('/')[0] || null
  }
  if (item.linkType === 'url') {
    const url = (item.url ?? '').trim()
    if (!url || /^https?:\/\//i.test(url) || url.startsWith('//')) return null
    return pageKeyFromPathname(url.startsWith('/') ? url : `/${url}`)
  }
  if (item.linkType === 'module') {
    const mod = modules.find((m) => m.moduleId === item.moduleId)
    const view = mod?.views.find((v) => v.key === item.moduleViewKey)
    if (!view?.href) return null
    return pageKeyFromPathname(view.href)
  }
  return null
}

/** Write nav item outline onto a layoutId-only page chrome row (when resolvable). */
export async function syncNavItemOutlineToPageChrome(
  item: NavMenuItem,
  pages: NavPageOption[],
  modules: NavModuleOption[],
): Promise<void> {
  const layoutId = typeof item.layoutId === 'string' ? item.layoutId.trim() : ''
  if (!layoutId) return
  const pageKey = pageKeyForNavItem(item, pages, modules)
  if (!pageKey) return

  // Document chrome is site-global only — page rows store outline assignment alone.
  await savePageChrome(pageKey, { pageKey, layoutId })
  await invalidatePageChrome(pageKey)
}

/**
 * Find a nav item’s layoutId for a pageKey (Assigned Menu / Navigation source of truth).
 * Prefers the site primary menu, then other menus.
 */
export async function lookupNavAssignedLayoutId(pageKey: string): Promise<string | null> {
  const key = pageKey.trim()
  if (!key) return null

  try {
    const settings = await getSiteSettings()
    const primaryId = (settings.primaryNavMenuId ?? '').trim()
    const [pages, modules, menus] = await Promise.all([
      listNavPageOptions(),
      Promise.resolve(listEnabledModuleNavOptions(settings)),
      listNavMenus(),
    ])
    const ordered = [...menus].sort((a, b) => {
      if (a.id === primaryId) return -1
      if (b.id === primaryId) return 1
      return 0
    })
    for (const menu of ordered) {
      const loaded = await loadNavMenu(menu.id)
      for (const item of flattenNavItemsInOrder(loaded.document.items)) {
        if (pageKeyForNavItem(item, pages, modules) !== key) continue
        const layoutId =
          typeof item.layoutId === 'string' && item.layoutId.trim() ? item.layoutId.trim() : ''
        if (layoutId) {
          return (await resolveExistingLayoutId(layoutId)) || layoutId
        }
      }
    }
  } catch {
    return null
  }
  return null
}

/** Clear page chrome layoutId when it still matches the outline being unassigned. */
export async function clearNavItemOutlineFromPageChrome(
  item: NavMenuItem,
  pages: NavPageOption[],
  modules: NavModuleOption[],
  outlineId: string,
): Promise<void> {
  const pageKey = pageKeyForNavItem(item, pages, modules)
  if (!pageKey) return
  const existing = await loadPageChromeOverride(pageKey)
  if (existing.isFallback) return
  const current = (existing.chrome.layoutId ?? '').trim()
  if (!current) return
  const target = outlineId.trim()
  const currentResolved = (await resolveExistingLayoutId(current)) || current
  const targetResolved = (await resolveExistingLayoutId(target)) || target
  if (current !== target && currentResolved !== targetResolved) return
  await deletePageChromeOverride(pageKey)
}

export async function syncNavMenuOutlinesToPageChrome(
  items: NavMenuItem[],
  pages: NavPageOption[],
  modules: NavModuleOption[],
): Promise<void> {
  for (const item of items) {
    await syncNavItemOutlineToPageChrome(item, pages, modules)
  }
}

/**
 * All nav menus + items with assignment state for one outline
 * (for Layouts → Assigned Menu toggles). Primary nav is listed first;
 * stale outline ids are healed so Assigned Menu matches Navigation.
 */
export async function listNavOutlineAssignmentTree(
  outlineId: string,
): Promise<NavOutlineAssignmentMenu[]> {
  const requested = outlineId.trim()
  if (!requested) return []

  const outline = (await resolveExistingLayoutId(requested)) || requested
  const [menus, settings, outlines] = await Promise.all([
    listNavMenus(),
    getSiteSettings(),
    listLayoutOutlines(),
  ])
  const primaryId = (settings.primaryNavMenuId ?? '').trim()
  const labelById = new Map(outlines.map((o) => [o.id, o.label] as const))

  const tree: NavOutlineAssignmentMenu[] = []

  for (const menu of menus) {
    const loaded = await loadNavMenu(menu.id)
    let healed = false
    const healedItems: NavMenuItem[] = []
    for (const item of loaded.document.items) {
      const raw =
        typeof item.layoutId === 'string' && item.layoutId.trim() ? item.layoutId.trim() : ''
      if (!raw) {
        healedItems.push(item)
        continue
      }
      const resolved = (await resolveExistingLayoutId(raw)) || raw
      if (resolved !== raw) {
        healed = true
        healedItems.push({ ...item, layoutId: resolved })
      } else {
        healedItems.push(item)
      }
    }
    if (healed) {
      await replaceNavMenuItems(menu.id, healedItems)
    }
    const ordered = flattenNavItemsInOrder(healed ? healedItems : loaded.document.items)

    const depthById = new Map<string, number>()
    for (const item of ordered) {
      const parentDepth =
        item.parentId && depthById.has(item.parentId)
          ? (depthById.get(item.parentId) as number)
          : -1
      depthById.set(item.id, parentDepth + 1)
    }

    tree.push({
      menuId: menu.id,
      menuLabel: menu.label,
      isPrimary: Boolean(primaryId) && menu.id === primaryId,
      items: ordered.map((item) => {
        const assignedId =
          typeof item.layoutId === 'string' && item.layoutId.trim() ? item.layoutId.trim() : ''
        const isAssigned = Boolean(assignedId) && assignedId === outline
        const otherId = assignedId && !isAssigned ? assignedId : null
        return {
          itemId: item.id,
          label: item.label,
          depth: depthById.get(item.id) ?? 0,
          assigned: isAssigned,
          otherOutlineId: otherId,
          otherOutlineLabel: otherId ? (labelById.get(otherId) ?? otherId) : null,
        }
      }),
    })
  }

  tree.sort((a, b) => {
    if (a.isPrimary === b.isPrimary) return a.menuLabel.localeCompare(b.menuLabel)
    return a.isPrimary ? -1 : 1
  })

  return tree
}

/**
 * Toggle whether a nav item uses `outlineId` as its layout assignment.
 * On → set layoutId + sync page chrome. Off → clear layoutId + clear matching chrome.
 */
export async function setNavItemOutlineAssignment(input: {
  menuId: string
  itemId: string
  outlineId: string
  assigned: boolean
}): Promise<{ ok: true } | { error: string }> {
  const menuId = input.menuId.trim()
  const itemId = input.itemId.trim()
  let outlineId = input.outlineId.trim()
  if (!menuId || !itemId || !outlineId) {
    return { error: 'Menu, item, and outline are required.' }
  }

  const existing = await resolveExistingLayoutId(outlineId)
  if (input.assigned && !existing) {
    return { error: `Outline “${outlineId}” was not found.` }
  }
  if (existing) outlineId = existing

  const loaded = await loadNavMenu(menuId)
  if (loaded.isFallback && loaded.source === 'empty') {
    return { error: `Menu “${menuId}” was not found.` }
  }

  const items = loaded.document.items.map((item) => ({ ...item }))
  const index = items.findIndex((item) => item.id === itemId)
  if (index < 0) return { error: `Menu item “${itemId}” was not found.` }

  const previous = items[index]!
  const nextItem: NavMenuItem = {
    ...previous,
    layoutId: input.assigned ? outlineId : null,
  }
  items[index] = nextItem

  const saved = await replaceNavMenuItems(menuId, items)
  if ('error' in saved) return saved

  try {
    const settings = await getSiteSettings()
    const [pages, modules] = await Promise.all([
      listNavPageOptions(),
      Promise.resolve(listEnabledModuleNavOptions(settings)),
    ])
    if (input.assigned) {
      await syncNavItemOutlineToPageChrome(nextItem, pages, modules)
    } else {
      await clearNavItemOutlineFromPageChrome(previous, pages, modules, outlineId)
    }
  } catch {
    // Page Settings / Payload may be unavailable — nav assignment still saved.
  }

  return { ok: true }
}
