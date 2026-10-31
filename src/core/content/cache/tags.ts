/**
 * Cache tags for published CMS reads.
 * Keep tag strings stable — Payload hooks + admin actions invalidate by these names.
 */
export const contentCacheTags = {
  /** All published pages (broad invalidation). */
  pages: 'sf:published-pages',
  /** One published page by slug. */
  page: (slug: string) => `sf:published-page:${slug}`,
  /** Site chrome (name + primary nav + feature flags). */
  siteSettings: 'sf:site-settings',
} as const
