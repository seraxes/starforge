import type { AppLocale } from '@/core/i18n/locales'
import { LOCALES } from '@/core/i18n/locales'

/**
 * Cache tags for published CMS reads.
 * Keep tag strings stable — Payload hooks + admin actions invalidate by these names.
 *
 * Page tags include locale (i18n P1) so `/en/about` and `/hu/about` invalidate independently
 * while still sharing a broad `sf:published-pages` / per-slug wildcard for editor saves.
 */
export const contentCacheTags = {
  /** All published pages (broad invalidation). */
  pages: 'sf:published-pages',
  /** One published page by slug + locale. */
  page: (slug: string, locale: AppLocale) => `sf:published-page:${locale}:${slug}`,
  /** All locale variants of one slug (invalidation after CMS save). */
  pageAllLocales: (slug: string): string[] =>
    LOCALES.map((locale) => contentCacheTags.page(slug, locale)),
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
