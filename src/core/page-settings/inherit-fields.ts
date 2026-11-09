import type { PageChrome } from './types'

/**
 * Page Settings fields that support per-input inherit (global ← page).
 * Omitted key on the page override row = inherit from site global.
 */
export const PAGE_CHROME_INHERIT_KEYS = [
  'layoutId',
  'sectionsLayout',
  'accessTags',
  'metaTags',
  'customHeadHtml',
  'faviconUrl',
  'touchIconUrl',
  'css',
  'javascript',
  'bodyId',
  'bodyClasses',
  'bodyTagAttributes',
  'afterBodyHtml',
  'beforeBodyCloseHtml',
  'fontAwesome',
] as const satisfies ReadonlyArray<keyof PageChrome>

export type PageChromeInheritKey = (typeof PAGE_CHROME_INHERIT_KEYS)[number]

export function isPageChromeInheritKey(value: string): value is PageChromeInheritKey {
  return (PAGE_CHROME_INHERIT_KEYS as readonly string[]).includes(value)
}

/** Keys present on a sparse override are local; missing inherit-capable keys inherit. */
export function inheritedKeysFromOverride(chrome: PageChrome | null | undefined): PageChromeInheritKey[] {
  if (!chrome) return [...PAGE_CHROME_INHERIT_KEYS]
  return PAGE_CHROME_INHERIT_KEYS.filter((key) => chrome[key] === undefined)
}

/** Drop inherit keys from a page chrome blob before persist. */
export function omitInheritedPageChromeKeys(
  chrome: PageChrome,
  inheritKeys: readonly string[],
): PageChrome {
  const omit = new Set(
    inheritKeys.map((k) => k.trim()).filter((k) => isPageChromeInheritKey(k)),
  )
  if (omit.size === 0) return chrome
  const next: PageChrome = { ...chrome }
  for (const key of omit) {
    delete next[key]
  }
  return next
}

export function parseInheritKeysJson(raw: unknown): PageChromeInheritKey[] {
  if (typeof raw !== 'string' || !raw.trim()) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((v) => String(v).trim())
      .filter(isPageChromeInheritKey)
  } catch {
    return []
  }
}
