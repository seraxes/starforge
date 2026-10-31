import { cache } from 'react'

import { HOME_PAGE_KEY } from './defaults'
import { mergePageChrome } from './merge'
import { loadGlobalPageChrome, loadPageChromeOverride } from './store'
import type { PageChrome, ResolvedPageChrome } from './types'

/**
 * Map a public pathname to a pageKey for chrome overrides.
 * `/` → `home`; `/about` → `about`; auth/admin paths → null (site global only).
 */
export function pageKeyFromPathname(pathname: string | null | undefined): string | null {
  if (!pathname) return null
  const path = pathname.split('?')[0]?.split('#')[0] || '/'
  if (
    path.startsWith('/app') ||
    path.startsWith('/admin') ||
    path.startsWith('/api') ||
    path.startsWith('/login') ||
    path.startsWith('/register') ||
    path.startsWith('/preview')
  ) {
    return null
  }
  if (path === '/' || path === '') return HOME_PAGE_KEY
  const slug = path.replace(/^\//, '').replace(/\/$/, '')
  if (!slug || slug.includes('/')) {
    // Nested paths: use first segment for v1 (matches CMS slug pages).
    return slug.split('/')[0] || null
  }
  return slug
}

/**
 * Resolve merged chrome for a pageKey (`null` = global only / unknown route).
 */
export async function resolvePageChrome(pageKey: string | null): Promise<ResolvedPageChrome> {
  const globalResult = await loadGlobalPageChrome()
  if (!pageKey) {
    return mergePageChrome(globalResult.chrome, null, null)
  }
  const pageResult = await loadPageChromeOverride(pageKey)
  if (pageResult.isFallback) {
    return mergePageChrome(globalResult.chrome, null, pageKey)
  }
  return mergePageChrome(globalResult.chrome, pageResult.chrome, pageKey)
}

/** Per-request dedupe for the same pageKey. */
export const getResolvedPageChrome = cache(async (pageKey: string | null): Promise<ResolvedPageChrome> => {
  return resolvePageChrome(pageKey)
})

export async function getGlobalPageChrome(): Promise<PageChrome> {
  const result = await loadGlobalPageChrome()
  return result.chrome
}

export async function getPageChromeOverride(pageKey: string): Promise<PageChrome | null> {
  const result = await loadPageChromeOverride(pageKey)
  if (result.isFallback) return null
  return result.chrome
}
