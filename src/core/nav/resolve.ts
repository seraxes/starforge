import type { NavItem, SiteSettingsData } from '@/core/settings/defaults'
import { DEFAULT_PRIMARY_NAV } from '@/core/settings/defaults'
import { normalizeHref, type RawNavRow, resolveNavItems } from '@/core/settings/nav'

import { getPageReads } from '@/core/content/page-reads'
import { buildNavItemKey } from '@/core/i18n/content-locale-keys'
import {
  loadContentLocaleCatalog,
  pickFromContentCatalog,
  type ContentLocaleCatalog,
} from '@/core/i18n/content-locales/store'
import { pickLocaleText } from '@/core/i18n/locale-text'
import { getLocaleTextContext } from '@/core/i18n/locale-text.server'

import { flattenNavItemsInOrder } from './document'
import { resolveModuleNavHref } from './module-views'
import { DEFAULT_NAV_MENU_ID, getCachedNavMenu } from './store'
import type { NavMenuItem } from './types'

export type ResolvedNavItem = NavItem & {
  id?: string
  cssClass?: string
  browserTitle?: string
  pageHeading?: string
  accessTags?: string[]
  accessLevel?: string
  pageId?: number | null
  moduleId?: string | null
  moduleViewKey?: string | null
  linkType?: NavMenuItem['linkType']
}

/**
 * Resolve page binds → slugs via PageReadsPort published summaries.
 * Unpublished page links stay unresolved (no href) — public nav is published-only.
 */
async function resolvePageSlugMap(
  pageIds: number[],
): Promise<Map<number, string>> {
  const map = new Map<number, string>()
  if (pageIds.length === 0) return map
  const wanted = new Set(pageIds)
  try {
    const docs = await getPageReads().listPublishedSummaries()
    for (const doc of docs) {
      if (wanted.has(doc.id) && doc.slug.trim()) {
        map.set(doc.id, doc.slug.trim())
      }
    }
  } catch {
    // Content manager unavailable
  }
  return map
}

function localized(
  key: string,
  map: Record<string, string> | undefined,
  scalar: string | null | undefined,
  locale: string,
  defaultLocale: string,
  fallbackEnabled: boolean,
  currentCatalog: ContentLocaleCatalog,
  defaultCatalog: ContentLocaleCatalog,
): string {
  const fromFile = pickFromContentCatalog(currentCatalog, key)
  if (fromFile) return fromFile
  if (fallbackEnabled && locale !== defaultLocale) {
    const fromDefault = pickFromContentCatalog(defaultCatalog, key)
    if (fromDefault) return fromDefault
  }
  return pickLocaleText(map, scalar ?? '', locale, defaultLocale, fallbackEnabled)
}

function itemToResolved(
  menuId: string,
  item: NavMenuItem,
  slugById: Map<number, string>,
  moduleHref: string | null,
  locale: string,
  defaultLocale: string,
  fallbackEnabled: boolean,
  currentCatalog: ContentLocaleCatalog,
  defaultCatalog: ContentLocaleCatalog,
): ResolvedNavItem | null {
  const label = localized(
    buildNavItemKey({ menuId, itemId: item.id, field: 'label' }),
    item.labels,
    item.label,
    locale,
    defaultLocale,
    fallbackEnabled,
    currentCatalog,
    defaultCatalog,
  )
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
  const browserTitle = localized(
    buildNavItemKey({ menuId, itemId: item.id, field: 'browserTitle' }),
    item.browserTitles,
    item.browserTitle,
    locale,
    defaultLocale,
    fallbackEnabled,
    currentCatalog,
    defaultCatalog,
  )
  const pageHeading = localized(
    buildNavItemKey({ menuId, itemId: item.id, field: 'pageHeading' }),
    item.pageHeadings,
    item.pageHeading,
    locale,
    defaultLocale,
    fallbackEnabled,
    currentCatalog,
    defaultCatalog,
  )
  if (browserTitle) resolved.browserTitle = browserTitle
  if (pageHeading) resolved.pageHeading = pageHeading
  if (item.accessTags?.length) {
    resolved.accessTags = [...item.accessTags]
    // Legacy single field for older consumers / layout slot parity helpers.
    resolved.accessLevel = item.accessTags[0]
  }
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
  const loaded = await getCachedNavMenu(id)

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
  const [slugById, localeCtx] = await Promise.all([
    resolvePageSlugMap(pageIds),
    getLocaleTextContext(),
  ])
  const [currentCatalog, defaultCatalog] = await Promise.all([
    loadContentLocaleCatalog(localeCtx.locale),
    localeCtx.locale === localeCtx.defaultLocale
      ? Promise.resolve({} as ContentLocaleCatalog)
      : loadContentLocaleCatalog(localeCtx.defaultLocale),
  ])
  const defaultCatalogResolved =
    localeCtx.locale === localeCtx.defaultLocale ? currentCatalog : defaultCatalog

  const out: ResolvedNavItem[] = []
  for (const item of ordered) {
    const moduleHref =
      item.linkType === 'module' && settings
        ? resolveModuleNavHref(settings, item.moduleId, item.moduleViewKey)
        : null
    const resolved = itemToResolved(
      id,
      item,
      slugById,
      moduleHref,
      localeCtx.locale,
      localeCtx.defaultLocale,
      localeCtx.fallbackEnabled,
      currentCatalog,
      defaultCatalogResolved,
    )
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
