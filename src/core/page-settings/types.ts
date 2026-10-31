/** Ordered stylesheet / script reference (Assets panel). */
export type AssetRef = {
  id: string
  name: string
  url: string
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
 * Document chrome + layout assignment (site global or per-page override).
 * Omitted / undefined fields inherit from global on merge.
 */
export type PageChrome = {
  /** null/omitted on global; slug or `home` on overrides. */
  pageKey?: string | null
  layoutId?: string
  sectionsLayout?: SectionsLayoutMode
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
}
