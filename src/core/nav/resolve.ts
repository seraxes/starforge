import { getPayload } from 'payload'

import config from '@payload-config'
import type { NavItem, SiteSettingsData } from '@/core/settings/defaults'
import { DEFAULT_PRIMARY_NAV } from '@/core/settings/defaults'
import { normalizeHref, type RawNavRow, resolveNavItems } from '@/core/settings/nav'

import { flattenNavItemsInOrder } from './document'
import { resolveModuleNavHref } from './module-views'
import { DEFAULT_NAV_MENU_ID, loadNavMenu } from './store'
import type { NavMenuItem } from './types'

export type ResolvedNavItem = NavItem & {
  id?: string
  cssClass?: string
  browserTitle?: string
  pageHeading?: string
  accessLevel?: string
  pageId?: number | null
  moduleId?: string | null
  moduleViewKey?: string | null
  linkType?: NavMenuItem['linkType']
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
  moduleHref: string | null,
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
  } else if (item.linkType === 'module') {
    if (!moduleHref) return null
    href = normalizeHref(moduleHref)
    if (!href) return null
  } else {
    href = normalizeHref(item.url ?? '')
    if (!href) return null
  }

  const resolved: ResolvedNavItem = { label, href, id: item.id, linkType: item.linkType }
  if (item.cssClass) resolved.cssClass = item.cssClass
  if (item.browserTitle) resolved.browserTitle = item.browserTitle
  if (item.pageHeading) resolved.pageHeading = item.pageHeading
  if (item.accessLevel) resolved.accessLevel = String(item.accessLevel)
  if (item.linkType === 'page' && item.pageId != null) resolved.pageId = item.pageId
  if (item.linkType === 'module') {
    resolved.moduleId = item.moduleId ?? null
    resolved.moduleViewKey = item.moduleViewKey ?? null
  }
  return resolved
}

/**
 * Resolve a navigation set to public `{ label, href, … }` items.
 * Pass `settings` so module links can honor Modules on/off (avoids circular
 * import with getSiteSettings). Module items are skipped when settings is
 * omitted, the module is off, or the view key is unknown.
 */
export async function resolveNavMenuItems(
  menuId: string | null | undefined,
  settings?: SiteSettingsData | null,
): Promise<ResolvedNavItem[]> {
  const id = (menuId || DEFAULT_NAV_MENU_ID).trim() || DEFAULT_NAV_MENU_ID
  const loaded = await loadNavMenu(id)

  if (loaded.isFallback && loaded.document.items.length === 0) {
    if (id !== DEFAULT_NAV_MENU_ID) {
      return resolveNavMenuItems(DEFAULT_NAV_MENU_ID, settings)
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
    const moduleHref =
      item.linkType === 'module' && settings
        ? resolveModuleNavHref(settings, item.moduleId, item.moduleViewKey)
        : null
    const resolved = itemToResolved(item, slugById, moduleHref)
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
