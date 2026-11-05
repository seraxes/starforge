/**
 * Core i18n port — thin host around next-intl for public `[locale]` routing.
 * Modules should import locale helpers from here, not configure next-intl directly.
 */

export {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_LABELS,
  isAppLocale,
} from './locales'
export type { AppLocale } from './locales'

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
