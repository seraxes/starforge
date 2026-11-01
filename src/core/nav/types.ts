/**
 * Nav manager document model (stored as JSON in `sf_nav_menus.document`).
 * Flat list + optional `parentId` for later nesting; public layout is flat for now.
 */

/**
 * Who-can-see tag — `group:<id>` maps to Users → Groups (no separate Access Level entity).
 * Items store multiple tags; visible if the viewer matches **any** (OR).
 */
export type NavAccessLevel =
  | 'public'
  | 'registered'
  | `group:${string}`

/**
 * Link bind types.
 * - `page` — Payload CMS page
 * - `url` — path or absolute URL (legacy storage may still say `custom`)
 * - `module` — installed/enabled module navigable view
 */
export type NavLinkType = 'page' | 'url' | 'module'

export type NavMenuItem = {
  id: string
  /** Null = top-level. Nesting UX can come later; storage is ready. */
  parentId: string | null
  /** Sibling order (ascending). */
  sortOrder: number
  label: string
  linkType: NavLinkType
  /** Payload `pages` document id when linkType is `page`. */
  pageId?: number | null
  /** Path or absolute URL when linkType is `url`. */
  url?: string | null
  /** Modules catalog / registry id when linkType is `module`. */
  moduleId?: string | null
  /** View key within that module’s `navViews`. */
  moduleViewKey?: string | null
  cssClass?: string | null
  /** Browser tab title override when this item is the active page. */
  browserTitle?: string | null
  /** On-page H1 override when this item is the active page. */
  pageHeading?: string | null
  /**
   * Multi-select access tags (`public` / `registered` / `group:<id>`).
   * Visible if viewer matches any tag. Default `['public']`.
   */
  accessTags: string[]
  /** @deprecated Migrated into `accessTags` on read. */
  accessLevel?: NavAccessLevel | string
}

export type NavMenuDocument = {
  version: 1
  items: NavMenuItem[]
}

export type NavMenuMeta = {
  id: string
  label: string
  createdAt: Date
  updatedAt: Date
  itemCount: number
}

/** Admin page picker option. */
export type NavPageOption = {
  id: number
  title: string
  slug: string
}

/** One navigable view on an enabled module (admin picker). */
export type NavModuleViewOption = {
  key: string
  label: string
  href: string
}

/** Enabled module that exposes at least one nav view. */
export type NavModuleOption = {
  moduleId: string
  moduleLabel: string
  views: NavModuleViewOption[]
}
