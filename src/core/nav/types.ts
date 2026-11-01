/**
 * Nav manager document model (stored as JSON in `sf_nav_menus.document`).
 * Flat list + optional `parentId` for later nesting; public layout is flat for now.
 */

/** Access stub until user-group ACL ships. */
export type NavAccessLevel =
  | 'public'
  | 'registered'
  /** Placeholder: `group:<id>` until Users → groups exist. */
  | `group:${string}`

export type NavLinkType = 'page' | 'custom'

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
  /** Path or absolute URL when linkType is `custom`. */
  url?: string | null
  cssClass?: string | null
  /** Browser tab title override when this item is the active page. */
  browserTitle?: string | null
  /** On-page H1 override when this item is the active page. */
  pageHeading?: string | null
  accessLevel: NavAccessLevel | string
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
