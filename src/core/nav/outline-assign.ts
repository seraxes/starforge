/**
 * Nav → Page Settings outline assignment.
 * Runtime resolves layoutId from Page Settings chrome; nav (Menus / Assigned Menu)
 * is the only admin UX that writes it — Page Settings does not edit layoutId.
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
  if (!current || current !== outlineId.trim()) return
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
 * (for Layouts → Assigned Menu toggles).
 */
export async function listNavOutlineAssignmentTree(
  outlineId: string,
): Promise<NavOutlineAssignmentMenu[]> {
  const outline = outlineId.trim()
  if (!outline) return []

  const menus = await listNavMenus()
  const tree: NavOutlineAssignmentMenu[] = []

  for (const menu of menus) {
    const loaded = await loadNavMenu(menu.id)
    const ordered = flattenNavItemsInOrder(loaded.document.items)
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
      items: ordered.map((item) => {
        const assignedId =
          typeof item.layoutId === 'string' && item.layoutId.trim() ? item.layoutId.trim() : ''
        return {
          itemId: item.id,
          label: item.label,
          depth: depthById.get(item.id) ?? 0,
          assigned: assignedId === outline,
          otherOutlineId: assignedId && assignedId !== outline ? assignedId : null,
        }
      }),
    })
  }

  return tree
}

/**
 * Toggle whether a nav item uses `outlineId` as its layout assignment.
 * On → set layoutId + sync Page Settings. Off → clear layoutId + clear matching chrome.
 */
export async function setNavItemOutlineAssignment(input: {
  menuId: string
  itemId: string
  outlineId: string
  assigned: boolean
}): Promise<{ ok: true } | { error: string }> {
  const menuId = input.menuId.trim()
  const itemId = input.itemId.trim()
  const outlineId = input.outlineId.trim()
  if (!menuId || !itemId || !outlineId) {
    return { error: 'Menu, item, and outline are required.' }
  }

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
