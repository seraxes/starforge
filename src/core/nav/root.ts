import 'server-only'

import { pageKeyFromPathname } from '@/core/page-settings/resolve'
import { getSiteSettings } from '@/core/settings'
import type { SiteSettingsData } from '@/core/settings/defaults'

import { resolveModuleNavHref } from './module-views'
import {
  internalRootHref,
  navItemCanBeRoot,
  type RootPageSlug,
  rootPageSlugFromTarget,
} from './root-target'
import { listNavPageOptions, loadNavMenu } from './store'
import type { NavMenuItem } from './types'

export type SiteRootResolved =
  | { kind: 'page'; pageId: string; slug: string; pageKey: string }
  | { kind: 'path'; href: string; pageKey: string | null }

/**
 * The one site root, with no locale on the pointer.
 * Null when unset, the item is gone, or the target cannot be rendered at `/{locale}`.
 * Callers then keep slug `home`.
 */
export async function resolveSiteRoot(): Promise<SiteRootResolved | null> {
  const settings = await getSiteSettings()
  return resolveSiteRootFromSettings(settings)
}

export async function resolveSiteRootFromSettings(
  settings: SiteSettingsData,
): Promise<SiteRootResolved | null> {
  const pointer = settings.rootItem
  if (!pointer) return null

  const loaded = await loadNavMenu(pointer.menuId)
  if (loaded.isFallback && loaded.source === 'empty') return null
  const item = loaded.document.items.find((row) => row.id === pointer.itemId)
  if (!item || !navItemCanBeRoot(item)) return null
  return targetForItem(item, settings)
}

export async function rootPageSlug(): Promise<RootPageSlug> {
  return rootPageSlugFromTarget(await resolveSiteRoot())
}

async function targetForItem(
  item: NavMenuItem,
  settings: SiteSettingsData,
): Promise<SiteRootResolved | null> {
  if (item.linkType === 'page') {
    if (item.pageId == null || item.pageId === '') return null
    const pages = await listNavPageOptions()
    const page = pages.find((row) => String(row.id) === String(item.pageId))
    const slug = page?.slug?.trim().replace(/^\/+|\/+$/g, '') || ''
    if (!slug) return null
    return { kind: 'page', pageId: String(page!.id), slug, pageKey: slug }
  }

  if (item.linkType === 'module') {
    const href = resolveModuleNavHref(settings, item.moduleId, item.moduleViewKey)
    const path = internalRootHref(href)
    if (!path) return null
    return { kind: 'path', href: path, pageKey: pageKeyFromPathname(path) }
  }

  const path = internalRootHref(item.url)
  if (!path) return null
  return { kind: 'path', href: path, pageKey: pageKeyFromPathname(path) }
}

/** Page key for a public path. `/` follows the root target; other paths stay path-based. */
export async function pageKeyForPublicPath(
  pathname: string | null | undefined,
): Promise<string | null> {
  const fromPath = pageKeyFromPathname(pathname)
  const bare = (pathname || '/').split('?')[0]?.split('#')[0] || '/'
  const path = bare.startsWith('/') ? bare : `/${bare}`
  const normalized = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path
  if (normalized !== '/') return fromPath
  const root = await resolveSiteRoot()
  if (!root) return fromPath
  return root.pageKey
}
