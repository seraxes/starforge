import { cache } from 'react'

import { pathnameWithoutLocale } from '@/core/i18n/path'

import { getPreferredLayoutId } from '@/core/skin/preferred-outline'

import { HOME_PAGE_KEY } from './defaults'
import { mergePageChrome } from './merge'
import { isOutlineChromeRowId } from './outline-chrome'
import { loadGlobalPageChrome, loadOutlinePageChrome, loadPageChromeOverride } from './store'
import type { PageChrome, ResolvedPageChrome } from './types'

/**
 * Map a public pathname to a pageKey for nav outline lookup (`sf_page_chrome` layoutId).
 * `/` or `/en` → `home`; `/en/about` → `about`; auth/admin paths → null.
 * Locale prefixes from Core i18n are stripped before matching.
 */
export function pageKeyFromPathname(pathname: string | null | undefined): string | null {
  if (!pathname) return null
  const path = pathnameWithoutLocale(pathname.split('?')[0]?.split('#')[0] || '/')
  if (
    path.startsWith('/admin') ||
    path.startsWith('/cms') ||
    path.startsWith('/api') ||
    path.startsWith('/login') ||
    path.startsWith('/register') ||
    path.startsWith('/preview') ||
    path.startsWith('/account') ||
    path.startsWith('/search') ||
    path.startsWith('/forgot-') ||
    path.startsWith('/reset-password') ||
    path.startsWith('/two-factor')
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
 * Resolve chrome for a pageKey (`null` = global only / unknown route).
 * Document chrome: Base outline = `global`; other outlines merge sparse `outline:<id>` over Base.
 * Nav pageKey rows only supply `layoutId` (which outline applies).
 */
export async function resolvePageChrome(pageKey: string | null): Promise<ResolvedPageChrome> {
  const [globalResult, preferredLayoutId] = await Promise.all([
    loadGlobalPageChrome(),
    getPreferredLayoutId(),
  ])
  const mergeOpts = { fallbackLayoutId: preferredLayoutId }
  const baseChrome = globalResult.chrome

  if (!pageKey) {
    return mergePageChrome(baseChrome, null, null, mergeOpts)
  }

  const pageResult = await loadPageChromeOverride(pageKey)
  const navLayoutId =
    !pageResult.isFallback && typeof pageResult.chrome.layoutId === 'string'
      ? pageResult.chrome.layoutId.trim()
      : ''
  const layoutId = navLayoutId || preferredLayoutId

  let outlineOverride: PageChrome | null = null
  if (layoutId && layoutId !== preferredLayoutId) {
    const outlineRow = await loadOutlinePageChrome(layoutId)
    if (!outlineRow.isFallback) {
      const { layoutId: _dropLayout, pageKey: _dropKey, ...rest } = outlineRow.chrome
      outlineOverride = rest
    }
  }

  return mergePageChrome(
    baseChrome,
    { ...(outlineOverride ?? {}), layoutId },
    pageKey,
    mergeOpts,
  )
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
  if (isOutlineChromeRowId(pageKey)) return null
  const result = await loadPageChromeOverride(pageKey)
  if (result.isFallback) return null
  return result.chrome
}
