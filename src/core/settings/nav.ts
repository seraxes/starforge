import type { NavItem, NavItemInput } from './defaults'
import { DEFAULT_PRIMARY_NAV } from './defaults'

/** Raw row from Payload `site-settings.primaryNav` (depth 0 or 1). */
export type RawNavRow = {
  label?: string | null
  linkType?: 'page' | 'custom' | null
  page?: number | string | { id?: number | string | null; slug?: string | null } | null
  url?: string | null
  /** Legacy text href from earlier site-settings shape. */
  href?: string | null
  cssClass?: string | null
  browserTitle?: string | null
  id?: string | null
}

function pageSlug(
  page: RawNavRow['page'],
): string | null {
  if (page == null) return null
  if (typeof page === 'object' && typeof page.slug === 'string' && page.slug.trim()) {
    return page.slug.trim()
  }
  return null
}

function pageId(page: RawNavRow['page']): number | string | null {
  if (page == null) return null
  if (typeof page === 'number' || typeof page === 'string') return page
  if (typeof page === 'object' && page.id != null) return page.id
  return null
}

/** Normalize a path or absolute URL for public links. */
export function normalizeHref(raw: string): string {
  const href = raw.trim()
  if (!href) return ''
  if (/^(https?:)?\/\//i.test(href) || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return href
  }
  return href.startsWith('/') ? href : `/${href}`
}

/**
 * Resolve Payload nav rows to public `{ label, href }` items.
 * Supports page relationships, custom URLs, and legacy `href` rows.
 */
export function resolveNavItems(raw: RawNavRow[] | null | undefined): NavItem[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_PRIMARY_NAV.map((item) => ({ ...item }))
  }

  const items: NavItem[] = []

  for (const row of raw) {
    const label = typeof row?.label === 'string' ? row.label.trim() : ''
    if (!label) continue

    const linkType = row.linkType === 'custom' || row.linkType === 'page' ? row.linkType : null

    if (linkType === 'page' || (!linkType && pageSlug(row.page))) {
      const slug = pageSlug(row.page)
      if (!slug) continue
      items.push({ label, href: normalizeHref(slug) })
      continue
    }

    if (linkType === 'custom' || (!linkType && typeof row.url === 'string' && row.url.trim())) {
      const href = normalizeHref(row.url ?? '')
      if (!href) continue
      items.push({ label, href })
      continue
    }

    // Legacy site-settings rows: label + href only
    if (typeof row.href === 'string' && row.href.trim()) {
      const href = normalizeHref(row.href)
      if (!href) continue
      items.push({ label, href })
    }
  }

  return items.length > 0 ? items : DEFAULT_PRIMARY_NAV.map((item) => ({ ...item }))
}

/** True when the stored nav already points at CMS pages (not only path strings). */
export function navHasPageLinks(raw: RawNavRow[] | null | undefined): boolean {
  if (!Array.isArray(raw) || raw.length === 0) return false
  return raw.some((row) => {
    if (row?.linkType === 'page' && pageId(row.page) != null) return true
    if (!row?.linkType && pageId(row.page) != null) return true
    return false
  })
}

/** Map core-admin label+href rows to Payload custom-URL nav items. */
export function navItemsToCustomInputs(items: NavItem[]): NavItemInput[] {
  return items
    .map((item) => ({
      label: item.label.trim(),
      linkType: 'custom' as const,
      url: normalizeHref(item.href),
    }))
    .filter((item) => item.label && item.url)
}

/** Build Payload page-relationship nav rows from slug → id map. */
export function pageNavInputs(
  entries: Array<{ label: string; pageId: number }>,
): NavItemInput[] {
  return entries.map((entry) => ({
    label: entry.label,
    linkType: 'page' as const,
    page: entry.pageId,
  }))
}

export function isExternalHref(href: string): boolean {
  return /^(https?:)?\/\//i.test(href) || href.startsWith('mailto:') || href.startsWith('tel:')
}

/** Whether `pathname` matches this nav href (internal paths only). */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (isExternalHref(href)) return false
  const path = pathname.split('?')[0]?.split('#')[0] || '/'
  const target = normalizeHref(href).split('?')[0]?.split('#')[0] || '/'
  if (target === '/') return path === '/'
  return path === target || path.startsWith(`${target}/`)
}
