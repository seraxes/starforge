import { DEFAULT_FONT_AWESOME, DEFAULT_PAGE_LAYOUT_ID, emptyResolvedChrome } from './defaults'
import type {
  AssetRef,
  FontAwesomeSettings,
  MetaTag,
  PageAtomInstance,
  PageChrome,
  ResolvedPageChrome,
  SectionsLayoutMode,
} from './types'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asSectionsLayout(value: unknown): SectionsLayoutMode | undefined {
  return value === 'fullwidth' || value === 'boxed' ? value : undefined
}

function normalizeMetaTags(value: unknown): MetaTag[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value
    .map((row, index) => {
      if (!isPlainObject(row)) return null
      const nameOrProperty = asString(row.nameOrProperty).trim()
      const content = asString(row.content)
      if (!nameOrProperty && !content) return null
      return {
        id: asString(row.id) || `meta-${index}`,
        nameOrProperty,
        content,
      }
    })
    .filter((row): row is MetaTag => Boolean(row))
}

function normalizeAssets(value: unknown): AssetRef[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value
    .map((row, index) => {
      if (!isPlainObject(row)) return null
      const url = asString(row.url).trim()
      const name = asString(row.name).trim() || url || `asset-${index + 1}`
      if (!url && !name) return null
      return {
        id: asString(row.id) || `asset-${index}`,
        name,
        url,
      }
    })
    .filter((row): row is AssetRef => Boolean(row))
}

function normalizeAtoms(value: unknown): PageAtomInstance[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value
    .map((row, index) => {
      if (!isPlainObject(row)) return null
      const type = asString(row.type).trim()
      if (!type) return null
      return {
        id: asString(row.id) || `atom-${index}`,
        type,
        enabled: row.enabled !== false,
        config: isPlainObject(row.config) ? { ...row.config } : {},
      }
    })
    .filter((row): row is PageAtomInstance => Boolean(row))
}

function normalizeFontAwesome(value: unknown): FontAwesomeSettings | undefined {
  if (!isPlainObject(value)) return undefined
  return {
    enabled: typeof value.enabled === 'boolean' ? value.enabled : undefined,
    v4Compat: typeof value.v4Compat === 'boolean' ? value.v4Compat : undefined,
    contentCompat: typeof value.contentCompat === 'boolean' ? value.contentCompat : undefined,
    version: typeof value.version === 'string' ? value.version : undefined,
    cssLinkHtml: typeof value.cssLinkHtml === 'string' ? value.cssLinkHtml : undefined,
    jsScriptHtml: typeof value.jsScriptHtml === 'string' ? value.jsScriptHtml : undefined,
  }
}

/**
 * Coerce unknown JSON into a partial PageChrome (invalid keys dropped).
 */
export function normalizePageChrome(raw: unknown, pageKey?: string | null): PageChrome {
  if (!isPlainObject(raw)) {
    return { pageKey: pageKey ?? null }
  }

  const chrome: PageChrome = {
    pageKey: pageKey === undefined ? (raw.pageKey as string | null | undefined) ?? null : pageKey,
  }

  const layoutId = asString(raw.layoutId).trim()
  if (layoutId) chrome.layoutId = layoutId

  const sectionsLayout = asSectionsLayout(raw.sectionsLayout)
  if (sectionsLayout) chrome.sectionsLayout = sectionsLayout

  const metaTags = normalizeMetaTags(raw.metaTags)
  if (metaTags) chrome.metaTags = metaTags

  if (typeof raw.customHeadHtml === 'string') chrome.customHeadHtml = raw.customHeadHtml
  if (typeof raw.faviconUrl === 'string') chrome.faviconUrl = raw.faviconUrl
  if (typeof raw.touchIconUrl === 'string') chrome.touchIconUrl = raw.touchIconUrl

  const css = normalizeAssets(raw.css)
  if (css) chrome.css = css
  const javascript = normalizeAssets(raw.javascript)
  if (javascript) chrome.javascript = javascript

  if (typeof raw.bodyId === 'string') chrome.bodyId = raw.bodyId
  if (typeof raw.bodyClasses === 'string') chrome.bodyClasses = raw.bodyClasses
  if (typeof raw.bodyTagAttributes === 'string') chrome.bodyTagAttributes = raw.bodyTagAttributes
  if (typeof raw.afterBodyHtml === 'string') chrome.afterBodyHtml = raw.afterBodyHtml
  if (typeof raw.beforeBodyCloseHtml === 'string') chrome.beforeBodyCloseHtml = raw.beforeBodyCloseHtml

  const fontAwesome = normalizeFontAwesome(raw.fontAwesome)
  if (fontAwesome) chrome.fontAwesome = fontAwesome

  const atoms = normalizeAtoms(raw.atoms)
  if (atoms) chrome.atoms = atoms

  return chrome
}

export function parsePageChromeJson(json: string, pageKey?: string | null): PageChrome | null {
  try {
    return normalizePageChrome(JSON.parse(json), pageKey)
  } catch {
    return null
  }
}

export function serializePageChrome(chrome: PageChrome): string {
  return JSON.stringify(chrome, null, 2)
}

function defined<T>(value: T | undefined): value is T {
  return value !== undefined
}

/**
 * Merge site global chrome with an optional per-page override.
 * Page fields win when present (including empty string / empty array).
 */
export function mergePageChrome(
  globalChrome: PageChrome | null | undefined,
  pageChrome?: PageChrome | null,
  pageKey: string | null = null,
): ResolvedPageChrome {
  const base = emptyResolvedChrome(pageKey)
  const g = globalChrome ?? {}
  const p = pageChrome ?? {}

  const pick = <K extends keyof PageChrome>(key: K): PageChrome[K] | undefined => {
    if (defined(p[key])) return p[key]
    if (defined(g[key])) return g[key]
    return undefined
  }

  const layoutId = asString(pick('layoutId')).trim() || DEFAULT_PAGE_LAYOUT_ID
  const sectionsLayout = asSectionsLayout(pick('sectionsLayout')) ?? base.sectionsLayout

  const faG = g.fontAwesome ?? {}
  const faP = p.fontAwesome ?? {}
  const fontAwesome: ResolvedPageChrome['fontAwesome'] = {
    enabled: faP.enabled ?? faG.enabled ?? DEFAULT_FONT_AWESOME.enabled,
    v4Compat: faP.v4Compat ?? faG.v4Compat ?? DEFAULT_FONT_AWESOME.v4Compat,
    contentCompat: faP.contentCompat ?? faG.contentCompat ?? DEFAULT_FONT_AWESOME.contentCompat,
    version: faP.version ?? faG.version ?? DEFAULT_FONT_AWESOME.version,
    cssLinkHtml: faP.cssLinkHtml ?? faG.cssLinkHtml ?? '',
    jsScriptHtml: faP.jsScriptHtml ?? faG.jsScriptHtml ?? '',
  }

  return {
    pageKey,
    layoutId,
    sectionsLayout,
    metaTags: pick('metaTags') ?? base.metaTags,
    customHeadHtml: asString(pick('customHeadHtml')),
    faviconUrl: asString(pick('faviconUrl')).trim(),
    touchIconUrl: asString(pick('touchIconUrl')).trim(),
    css: pick('css') ?? base.css,
    javascript: pick('javascript') ?? base.javascript,
    bodyId: asString(pick('bodyId')).trim(),
    bodyClasses: asString(pick('bodyClasses')).trim(),
    bodyTagAttributes: asString(pick('bodyTagAttributes')).trim(),
    afterBodyHtml: asString(pick('afterBodyHtml')),
    beforeBodyCloseHtml: asString(pick('beforeBodyCloseHtml')),
    fontAwesome,
    atoms: pick('atoms') ?? base.atoms,
  }
}

/**
 * Fields that require developer-admin to change.
 * Non-developer saves keep prior values for these keys.
 */
export const DEVELOPER_ADMIN_CHROME_KEYS = [
  'customHeadHtml',
  'javascript',
  'afterBodyHtml',
  'beforeBodyCloseHtml',
] as const

export type DeveloperAdminChromeKey = (typeof DEVELOPER_ADMIN_CHROME_KEYS)[number]

/**
 * Strip developer-only fields from an incoming chrome patch, keeping `prior` values.
 * Also clears FA override HTML and script-capable atom configs when not developer.
 */
export function applyDeveloperAdminGate(
  incoming: PageChrome,
  prior: PageChrome | null | undefined,
  isDeveloperAdmin: boolean,
): PageChrome {
  if (isDeveloperAdmin) return incoming

  const next: PageChrome = { ...incoming }
  const prev = prior ?? {}

  for (const key of DEVELOPER_ADMIN_CHROME_KEYS) {
    if (defined(prev[key])) {
      ;(next as Record<string, unknown>)[key] = prev[key]
    } else {
      delete (next as Record<string, unknown>)[key]
    }
  }

  if (next.fontAwesome) {
    next.fontAwesome = {
      ...next.fontAwesome,
      cssLinkHtml: prev.fontAwesome?.cssLinkHtml ?? '',
      jsScriptHtml: prev.fontAwesome?.jsScriptHtml ?? '',
    }
  }

  // Keep prior atom list when any atom type requires developer (safer than partial edit).
  if (Array.isArray(prev.atoms)) {
    next.atoms = prev.atoms
  }

  return next
}
