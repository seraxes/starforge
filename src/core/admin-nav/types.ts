/** Shared admin left-nav model — Core `/admin` and Payload `/cms/admin` consume the same tree. */

export type AdminNavLink = {
  href: string
  label: string
  /** Exact match only (e.g. Check site → `/`, CMS Dashboard → `/cms/admin`). */
  exact?: boolean
  /** Cross-surface link (Core ↔ Payload); still same-tab navigation. */
  external?: boolean
}

export type AdminNavGroup = {
  id: string
  label: string
  /** Default landing when useful for “group is active” heuristics. */
  href?: string
  /**
   * When true, accordion starts expanded even if the route is outside this group
   * (so children like Site Chrome → Environment stay discoverable).
   */
  defaultOpen?: boolean
  /**
   * Force Joomla-style accordion even when `links.length === 1`.
   * Multi-link groups are always expandable; set this on Site Chrome so
   * Environment cannot be flattened away by a one-link heuristic drift.
   */
  expandable?: boolean
  links: AdminNavLink[]
}

export type AdminNavSurface = 'core' | 'payload'

export type AdminNavFeatureFlags = {
  nav: boolean
  /**
   * @deprecated Prefer enabledModuleIds + manifest admin.nav (M2).
   * Kept optional for older callers/tests; ignored when contributions exist.
   */
  forms?: boolean
  /**
   * @deprecated Prefer enabledModuleIds + manifest admin.nav (M2).
   */
  redirects?: boolean
  layout: boolean
  pageSettings: boolean
  /** Payload CMS module on + user may open /cms/admin. */
  cms: boolean
}

/** Payload collection / global destinations under the CMS accordion. */
export type AdminCmsNavLink = AdminNavLink & {
  /** Payload entity kind — used when filtering by visibleEntities. */
  entity?: 'collection' | 'global' | 'dashboard'
  slug?: string
}
