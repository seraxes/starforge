import type { CspSources } from '@/core/security/csp'

/** Inclusive load-priority bounds for Page Settings CSS/JS assets. */
export const ASSET_PRIORITY_MIN = -10
export const ASSET_PRIORITY_MAX = 10

/**
 * Ordered stylesheet / script asset (Assets panel).
 * Prefer an editable inline `content` “file”; optional external `url` still supported.
 * Lower `priority` loads earlier in head / body inject order (−10 … +10).
 */
export type AssetRef = {
  id: string
  name: string
  /** External stylesheet / script URL (optional when `content` is set). */
  url: string
  /** Editable inline CSS or JS “file” body. */
  content?: string
  /** Load order weight (−10 earliest … +10 latest). Default 0. */
  priority?: number
}

/** Repeatable meta name/property + content (Head Properties). */
export type MetaTag = {
  id: string
  nameOrProperty: string
  content: string
}

export type SectionsLayoutMode = 'fullwidth' | 'boxed'

export type FontAwesomeSettings = {
  enabled?: boolean
  v4Compat?: boolean
  contentCompat?: boolean
  /** e.g. `6-free`, `7-free` */
  version?: string
  /** Advanced override — raw `<link>` HTML. Developer-admin. */
  cssLinkHtml?: string
  /** Advanced override — raw `<script>` HTML. Developer-admin. */
  jsScriptHtml?: string
}

export type PageAtomInstance = {
  id: string
  type: string
  enabled: boolean
  config: Record<string, unknown>
}

/**
 * Document chrome. Site-global row holds full chrome; page rows are layoutId-only
 * (written by nav outline assignment — not Page Settings UI).
 */
export type PageChrome = {
  /** null/omitted on global; slug or `home` on overrides. */
  pageKey?: string | null
  /** Outline id — nav-owned; runtime slot synced from menu item assignment. */
  layoutId?: string
  sectionsLayout?: SectionsLayoutMode
  /**
   * Who can VIEW this page (Nav/Layout tokens): `public` | `registered` | `group:<id>`.
   * Match ANY; omitted / empty = public. Groups only — no Access Level entity.
   */
  accessTags?: string[]
  metaTags?: MetaTag[]
  /** Free HTML in `<head>`. Developer-admin. */
  customHeadHtml?: string
  faviconUrl?: string
  touchIconUrl?: string
  css?: AssetRef[]
  /** Ordered scripts. Developer-admin. */
  javascript?: AssetRef[]
  bodyId?: string
  bodyClasses?: string
  /** Extra attributes string on `<body>` (e.g. `data-theme="dark"`). */
  bodyTagAttributes?: string
  /** HTML after opening `<body>`. Developer-admin. */
  afterBodyHtml?: string
  /** HTML before closing `</body>`. Developer-admin. */
  beforeBodyCloseHtml?: string
  fontAwesome?: FontAwesomeSettings
  atoms?: PageAtomInstance[]
}

/** Fully resolved chrome after global ← page merge (all fields present). */
export type ResolvedPageChrome = {
  pageKey: string | null
  layoutId: string
  sectionsLayout: SectionsLayoutMode
  /** Resolved viewing tags (empty / public-only = public). */
  accessTags: string[]
  metaTags: MetaTag[]
  customHeadHtml: string
  faviconUrl: string
  touchIconUrl: string
  css: AssetRef[]
  javascript: AssetRef[]
  bodyId: string
  bodyClasses: string
  bodyTagAttributes: string
  afterBodyHtml: string
  beforeBodyCloseHtml: string
  fontAwesome: Required<
    Pick<FontAwesomeSettings, 'enabled' | 'v4Compat' | 'contentCompat' | 'version'>
  > &
    Pick<FontAwesomeSettings, 'cssLinkHtml' | 'jsScriptHtml'>
  atoms: PageAtomInstance[]
}

export type AtomInjectTarget = 'head' | 'body-start' | 'body-end'

export type AtomInjectResult = {
  target: AtomInjectTarget
  html?: string
  /** Extra stylesheet URLs. */
  cssUrls?: string[]
  /** Extra script URLs (end of body). */
  scriptUrls?: string[]
}

export type StarforgeAtomDefinition = {
  type: string
  label: string
  description?: string
  /** True when config can inject scripts / inline JS — developer-admin to edit. */
  requiresDeveloperAdmin?: boolean
  defaultConfig: () => Record<string, unknown>
  /** Build inject fragments from instance config. */
  inject: (config: Record<string, unknown>) => AtomInjectResult[]
  /**
   * CSP sources the atom needs beyond what its inject URLs / HTML attributes
   * show (e.g. a loader that builds the script URL in JS, XHR beacons).
   */
  csp?: (config: Record<string, unknown>) => CspSources | null
}
