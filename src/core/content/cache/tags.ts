/**
 * Cache tags for published CMS reads.
 * Keep tag strings stable — Payload hooks + admin actions invalidate by these names.
 */
export const contentCacheTags = {
  /** All published pages (broad invalidation). */
  pages: 'sf:published-pages',
  /** One published page by slug. */
  page: (slug: string) => `sf:published-page:${slug}`,
  /** Site settings global (Modules / nav assignment / legacy site name). */
  siteSettings: 'sf:site-settings',
  /** Site Chrome policy document (`sf_site_chrome`). */
  siteChrome: 'sf:site-chrome',
} as const
