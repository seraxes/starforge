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
  /** All layout outlines (broad). */
  layouts: 'sf:layouts',
  /** One layout outline by id. */
  layout: (layoutId: string) => `sf:layout:${layoutId}`,
  /** All Nav manager menus (broad). */
  navMenus: 'sf:nav-menus',
  /** One Nav manager menu by id. */
  navMenu: (menuId: string) => `sf:nav-menu:${menuId}`,
  /** All Page Settings chrome rows (global + overrides). */
  pageChrome: 'sf:page-chrome',
  /** One Page Settings chrome row (`global` or pageKey). */
  pageChromeRow: (id: string) => `sf:page-chrome:${id}`,
  /**
   * Proxy edge policy fragments (composed CSP sources).
   * Bumped whenever chrome / settings / page-chrome change.
   */
  proxyPolicy: 'sf:proxy-policy',
} as const
