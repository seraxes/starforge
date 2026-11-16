/** Admin left-nav model for Core `/admin`. */

export type AdminNavLink = {
  href: string
  label: string
  /** Exact match only (e.g. Dashboard → `/admin`). */
  exact?: boolean
  /** Link that leaves the current admin shell. */
  external?: boolean
  /** Nested leaves under this link (e.g. Outline → Layout / Styles / Page settings). */
  children?: AdminNavLink[]
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
  /**
   * Ignored. The Payload CMS accordion was removed in phase 4.
   * Kept so existing flag objects still typecheck.
   */
  cms?: boolean
}
