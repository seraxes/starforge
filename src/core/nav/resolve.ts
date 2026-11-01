import { getPayload } from 'payload'

import config from '@payload-config'
import type { NavItem } from '@/core/settings/defaults'
import { DEFAULT_PRIMARY_NAV } from '@/core/settings/defaults'
import { normalizeHref, type RawNavRow, resolveNavItems } from '@/core/settings/nav'

import { flattenNavItemsInOrder } from './document'
import { DEFAULT_NAV_MENU_ID, loadNavMenu } from './store'
import type { NavMenuItem } from './types'

export type ResolvedNavItem = NavItem & {
  id?: string
  cssClass?: string
  browserTitle?: string
  pageHeading?: string
  accessLevel?: string
  pageId?: number | null
}

async function resolvePageSlugMap(
  pageIds: number[],
): Promise<Map<number, string>> {
  const map = new Map<number, string>()
  if (pageIds.length === 0) return map
  try {
    const payload = await getPayload({ config })
    const result = await payload.find({
      collection: 'pages',
      where: { id: { in: pageIds } },
      depth: 0,
      limit: pageIds.length,
      overrideAccess: true,
      pagination: false,
    })
    for (const doc of result.docs) {
      if (typeof doc.id === 'number' && typeof doc.slug === 'string' && doc.slug.trim()) {
        map.set(doc.id, doc.slug.trim())
      }
    }
  } catch {
    // Payload unavailable
  }
  return map
}

function itemToResolved(
  item: NavMenuItem,
  slugById: Map<number, string>,
): ResolvedNavItem | null {
  const label = item.label.trim()
  if (!label) return null

  let href = ''
  if (item.linkType === 'page') {
    const pageId = typeof item.pageId === 'number' ? item.pageId : null
    if (pageId == null) return null
    const slug = slugById.get(pageId)
    if (!slug) return null
    href = normalizeHref(slug)
  } else {
    href = normalizeHref(item.url ?? '')
    if (!href) return null
  }

  const resolved: ResolvedNavItem = { label, href, id: item.id }
  if (item.cssClass) resolved.cssClass = item.cssClass
  if (item.browserTitle) resolved.browserTitle = item.browserTitle
  if (item.pageHeading) resolved.pageHeading = item.pageHeading
  if (item.accessLevel) resolved.accessLevel = String(item.accessLevel)
  if (item.linkType === 'page' && item.pageId != null) resolved.pageId = item.pageId
  return resolved
}

/**
 * Resolve a navigation set to public `{ label, href, … }` items.
 * Flat order (parents then children); nesting render comes later.
 * Access-level filtering is stubbed — all items returned for now.
 */
export async function resolveNavMenuItems(
  menuId: string | null | undefined,
): Promise<ResolvedNavItem[]> {
  const id = (menuId || DEFAULT_NAV_MENU_ID).trim() || DEFAULT_NAV_MENU_ID
  const loaded = await loadNavMenu(id)

  if (loaded.isFallback && loaded.document.items.length === 0) {
    // Try default Main if a custom id was empty
    if (id !== DEFAULT_NAV_MENU_ID) {
      return resolveNavMenuItems(DEFAULT_NAV_MENU_ID)
    }
    return DEFAULT_PRIMARY_NAV.map((i) => ({ ...i }))
  }

  const ordered = flattenNavItemsInOrder(loaded.document.items)
  const pageIds = ordered
    .filter((i) => i.linkType === 'page' && typeof i.pageId === 'number')
    .map((i) => i.pageId as number)
  const slugById = await resolvePageSlugMap(pageIds)

  const out: ResolvedNavItem[] = []
  for (const item of ordered) {
    const resolved = itemToResolved(item, slugById)
    if (resolved) out.push(resolved)
  }

  return out.length > 0 ? out : DEFAULT_PRIMARY_NAV.map((i) => ({ ...i }))
}

/** Find overrides for the current public path (browser title / page heading). */
export function findNavOverridesForPath(
  items: ResolvedNavItem[],
  pathname: string,
): { browserTitle?: string; pageHeading?: string } | null {
  const path = pathname.split('?')[0]?.split('#')[0] || '/'
  for (const item of items) {
    const target = normalizeHref(item.href).split('?')[0]?.split('#')[0] || '/'
    if (target === path || (target !== '/' && path.startsWith(`${target}/`))) {
      if (item.browserTitle || item.pageHeading) {
        return {
          ...(item.browserTitle ? { browserTitle: item.browserTitle } : {}),
          ...(item.pageHeading ? { pageHeading: item.pageHeading } : {}),
        }
      }
    }
  }
  return null
}

/** Bridge: resolve legacy Payload primaryNav rows when no menu id is set. */
export function resolveLegacyPrimaryNav(
  raw: RawNavRow[] | null | undefined,
): NavItem[] {
  return resolveNavItems(raw)
}
