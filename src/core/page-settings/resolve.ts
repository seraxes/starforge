import { cache } from 'react'

import { pathnameWithoutLocale } from '@/core/i18n/path'

import { getPreferredLayoutId } from '@/core/skin/preferred-outline'

import { GLOBAL_PAGE_CHROME_ID } from '@/core/db'

import { HOME_PAGE_KEY } from './defaults'
import { mergePageChrome } from './merge'
import {
  isOutlineChromeRowId,
  outlineChromeRowId,
} from './outline-chrome'
import {
  loadGlobalPageChrome,
  loadOutlinePageChrome,
  loadPageChromeOverride,
  loadPageChromeRowUncached,
} from './store'
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
 * Public request pathname for outline resolve (proxy stamps `x-sf-pathname`).
 * Falls back to bare path + locale, then `next-url`, then `/{locale}`.
 */
export function publicPathnameFromHeaders(
  headerList: Headers,
  locale: string,
): string {
  const full = (headerList.get('x-sf-pathname') || '').trim()
  if (full) return full.split('?')[0]?.split('#')[0] || full

  const bare = (headerList.get('x-sf-pathname-bare') || '').trim()
  if (bare) {
    const path = bare.startsWith('/') ? bare : `/${bare}`
    if (path === '/') return `/${locale}`
    return `/${locale}${path}`
  }

  const nextUrl = (headerList.get('next-url') || headerList.get('x-url') || '').trim()
  if (nextUrl) {
    try {
      const path = nextUrl.startsWith('http')
        ? new URL(nextUrl).pathname
        : nextUrl.split('?')[0]?.split('#')[0] || ''
      if (path) return path
    } catch {
      // ignore malformed
    }
  }

  return `/${locale}`
}

/**
 * Resolve chrome for a pageKey (`null` = global only / unknown route).
 * Document chrome: Base outline = `global`; other outlines merge sparse `outline:<id>` over Base.
 *
 * Outline assignment (`layoutId`): **Navigation / Assigned Menu owns it**.
 * Always prefer live nav lookup over `sf_page_chrome` (chrome is a sync mirror and may be stale).
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

  const { lookupNavAssignedLayoutId } = await import('@/core/nav/outline-assign')
  const { resolveExistingLayoutId } = await import('@/core/modules/layout-store')

  // Nav is source of truth (Assigned Menu / item Layout outline).
  let navLayoutId = (await lookupNavAssignedLayoutId(pageKey)) || ''

  // Fall back to page chrome mirror only when nav has no assignment for this pageKey.
  if (!navLayoutId) {
    const pageResult = await loadPageChromeOverride(pageKey)
    if (!pageResult.isFallback && typeof pageResult.chrome.layoutId === 'string') {
      navLayoutId = pageResult.chrome.layoutId.trim()
    }
  }

  // Heal stale short ids (`pastel-test` → `starforge-pastel-test`).
  if (navLayoutId) {
    navLayoutId = (await resolveExistingLayoutId(navLayoutId)) || navLayoutId
  }
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

async function mergeOutlinePageChrome(
  outlineId: string | null | undefined,
  loadGlobal: () => Promise<{ chrome: PageChrome }>,
  loadOutline: (layoutId: string) => Promise<{ chrome: PageChrome; isFallback: boolean }>,
): Promise<ResolvedPageChrome> {
  const [globalResult, preferredLayoutId] = await Promise.all([
    loadGlobal(),
    getPreferredLayoutId(),
  ])
  const mergeOpts = { fallbackLayoutId: preferredLayoutId }
  const baseChrome = globalResult.chrome

  const rawId = typeof outlineId === 'string' ? outlineId.trim() : ''
  const { resolveExistingLayoutId } = await import('@/core/modules/layout-store')
  const layoutId =
    (rawId ? (await resolveExistingLayoutId(rawId)) || rawId : '') || preferredLayoutId

  let outlineOverride: PageChrome | null = null
  if (layoutId && layoutId !== preferredLayoutId) {
    const outlineRow = await loadOutline(layoutId)
    if (!outlineRow.isFallback) {
      const { layoutId: _dropLayout, pageKey: _dropKey, ...rest } = outlineRow.chrome
      outlineOverride = rest
    }
  }

  return mergePageChrome(
    baseChrome,
    { ...(outlineOverride ?? {}), layoutId },
    null,
    mergeOpts,
  )
}

/**
 * Resolve document chrome for a known outline id (offline / 404 / system screens).
 * Same Base ← outline sparse merge as public pages, without nav pageKey lookup.
 */
export async function resolvePageChromeForOutline(
  outlineId: string | null | undefined,
): Promise<ResolvedPageChrome> {
  return mergeOutlinePageChrome(outlineId, loadGlobalPageChrome, loadOutlinePageChrome)
}

/**
 * Uncached outline chrome for offline / 503 — skips published-content cache stalls.
 */
export async function resolvePageChromeForOutlineLive(
  outlineId: string | null | undefined,
): Promise<ResolvedPageChrome> {
  return mergeOutlinePageChrome(
    outlineId,
    () => loadPageChromeRowUncached(GLOBAL_PAGE_CHROME_ID),
    (layoutId) => loadPageChromeRowUncached(outlineChromeRowId(layoutId)),
  )
}

/** Per-request dedupe for the same pageKey. */
export const getResolvedPageChrome = cache(async (pageKey: string | null): Promise<ResolvedPageChrome> => {
  return resolvePageChrome(pageKey)
})

/** Per-request dedupe for system outlines (offline / not-found). */
export const getResolvedPageChromeForOutline = cache(
  async (outlineId: string | null | undefined): Promise<ResolvedPageChrome> => {
    return resolvePageChromeForOutline(outlineId)
  },
)

/** Per-request dedupe for live (uncached) system-outline chrome. */
export const getResolvedPageChromeForOutlineLive = cache(
  async (outlineId: string | null | undefined): Promise<ResolvedPageChrome> => {
    return resolvePageChromeForOutlineLive(outlineId)
  },
)

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
