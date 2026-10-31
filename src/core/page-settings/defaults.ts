import type { PageChrome, ResolvedPageChrome } from './types'

export const HOME_PAGE_KEY = 'home'

/** Matches `DEFAULT_LAYOUT_ID` in core db schema — kept local so client forms can import defaults. */
export const DEFAULT_PAGE_LAYOUT_ID = 'default'

export const DEFAULT_FONT_AWESOME = {
  enabled: false,
  v4Compat: false,
  contentCompat: false,
  version: '6-free',
  cssLinkHtml: '',
  jsScriptHtml: '',
} as const

/** Empty global chrome — site defaults before admin customization. */
export const DEFAULT_GLOBAL_PAGE_CHROME: PageChrome = {
  pageKey: null,
  layoutId: DEFAULT_PAGE_LAYOUT_ID,
  sectionsLayout: 'fullwidth',
  metaTags: [],
  customHeadHtml: '',
  faviconUrl: '',
  touchIconUrl: '',
  css: [],
  javascript: [],
  bodyId: '',
  bodyClasses: '',
  bodyTagAttributes: '',
  afterBodyHtml: '',
  beforeBodyCloseHtml: '',
  fontAwesome: { ...DEFAULT_FONT_AWESOME },
  atoms: [],
}

export function emptyResolvedChrome(pageKey: string | null = null): ResolvedPageChrome {
  return {
    pageKey,
    layoutId: DEFAULT_PAGE_LAYOUT_ID,
    sectionsLayout: 'fullwidth',
    metaTags: [],
    customHeadHtml: '',
    faviconUrl: '',
    touchIconUrl: '',
    css: [],
    javascript: [],
    bodyId: '',
    bodyClasses: '',
    bodyTagAttributes: '',
    afterBodyHtml: '',
    beforeBodyCloseHtml: '',
    fontAwesome: { ...DEFAULT_FONT_AWESOME },
    atoms: [],
  }
}

/** Stable id for new meta / asset / atom rows. */
export function newPageSettingsEntityId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefix}-${rand}`
}
