import type { SiteRootPointer } from '@/core/settings/defaults'
import { HOME_PAGE_KEY } from '@/core/page-settings/defaults'

export type { SiteRootPointer }

/**
 * Page slug that owns `/`, for path builders.
 * - `undefined` — no root is set; slug `home` owns `/`.
 * - a slug — that page owns `/`.
 * - `null` — a module or internal path owns `/`; no page slug does.
 */
export type RootPageSlug = string | null | undefined

export function normalizeSiteRootPointer(raw: unknown): SiteRootPointer | null {
  if (!raw || typeof raw !== 'object') return null
  const menuId =
    'menuId' in raw && typeof raw.menuId === 'string' ? raw.menuId.trim() : ''
  const itemId =
    'itemId' in raw && typeof raw.itemId === 'string' ? raw.itemId.trim() : ''
  if (!menuId || !itemId) return null
  return { menuId, itemId }
}

/** External URLs cannot be rendered at `/{locale}`. */
export function isExternalNavTarget(raw: string): boolean {
  const href = raw.trim()
  if (!href) return false
  return (
    /^(https?:)?\/\//i.test(href) ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:')
  )
}

/**
 * Internal path a URL item can own as the site root.
 * Empty, external, and `/` itself are refused (`/` is already the root URL).
 */
export function internalRootHref(raw: string | null | undefined): string | null {
  const href = typeof raw === 'string' ? raw.trim() : ''
  if (!href || isExternalNavTarget(href)) return null
  const path = (href.startsWith('/') ? href : `/${href}`).split('?')[0]?.split('#')[0] || '/'
  const normalized = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path
  if (!normalized || normalized === '/') return null
  return normalized
}

export function navItemCanBeRoot(item: {
  linkType: string
  url?: string | null
}): boolean {
  if (item.linkType === 'admin') return false
  if (item.linkType === 'url') return internalRootHref(item.url) != null
  return item.linkType === 'page' || item.linkType === 'module'
}

/**
 * Bare public path for a page slug.
 * `rootPageSlug` follows {@link RootPageSlug}.
 */
export function barePathForSlug(slug: string, rootPageSlug: RootPageSlug): string {
  const trimmed = slug.trim().replace(/^\/+|\/+$/g, '')
  if (rootPageSlug === undefined) {
    if (!trimmed || trimmed === HOME_PAGE_KEY) return '/'
    return `/${trimmed}`
  }
  if (rootPageSlug === null) {
    return trimmed ? `/${trimmed}` : '/'
  }
  if (trimmed === rootPageSlug.replace(/^\/+|\/+$/g, '')) return '/'
  return trimmed ? `/${trimmed}` : '/'
}

export function rootPageSlugFromTarget(
  target: { kind: 'page'; slug: string } | { kind: 'path' } | null,
): RootPageSlug {
  if (!target) return undefined
  if (target.kind === 'page') return target.slug
  return null
}
