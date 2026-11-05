/**
 * Core i18n port — thin host around next-intl for public `[locale]` routing.
 * Modules should import locale helpers from here, not configure next-intl directly.
 */

export {
  BOOTSTRAP_LOCALES,
  DEFAULT_LOCALE,
  DEFAULT_LOCALE_CATALOG,
  LOCALES,
  LOCALE_LABELS,
  isAppLocale,
  isBootstrapLocale,
  isRegisteredLocaleCode,
  isValidLocaleCode,
  labelForLocale,
  listRegisteredLocaleCodes,
  normalizeLocaleCode,
  registerPublicLocaleCodes,
  toPayloadLocale,
} from './locales'
export type { AppLocale, BootstrapLocale, LocaleCatalogEntry } from './locales'

export { routing } from './routing'

export {
  Link,
  redirect,
  usePathname,
  useRouter,
  getPathname,
} from './navigation'

export {
  hasLocalePrefix,
  pathnameWithoutLocale,
  stripLocalePrefix,
  withLocalePrefix,
} from './path'
export type { PathWithoutLocale } from './path'

export {
  buildLanguageAlternates,
  languageAlternateMetadata,
} from './alternates'

export {
  coerceAppLocale,
  isLocaleAwareNavItemActive,
  navHref,
} from './nav'

/**
 * Server-only enabled-locale loaders live in `./enabled` — do **not** re-export
 * them from this barrel. Client components (SiteNav, LocaleSwitcher) import
 * from here; pulling `enabled.ts` leaks Payload/`next/headers` into the client
 * graph (flavor/minimal build). Import `@/core/i18n/enabled` on the server.
 */
