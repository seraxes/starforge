import { DEFAULT_LOCALE, isAppLocale, type AppLocale } from './locales'

export type PathWithoutLocale = {
  locale: AppLocale | null
  /** Pathname with locale prefix removed (always starts with `/`). */
  pathname: string
}

/**
 * Strip a leading `/{locale}` segment when it matches the platform catalog.
 * `/en/about` → `{ locale: 'en', pathname: '/about' }`
 * `/admin` → `{ locale: null, pathname: '/admin' }`
 */
export function stripLocalePrefix(pathname: string): PathWithoutLocale {
  const raw = (pathname || '/').split('?')[0]?.split('#')[0] || '/'
  const normalized = raw.startsWith('/') ? raw : `/${raw}`
  if (normalized === '/') {
    return { locale: null, pathname: '/' }
  }

  const segments = normalized.split('/')
  // ['', 'en', 'about'] or ['', 'en']
  const maybeLocale = segments[1]
  if (!isAppLocale(maybeLocale)) {
    return { locale: null, pathname: normalized.length > 1 ? normalized.replace(/\/$/, '') || '/' : '/' }
  }

  const rest = segments.slice(2).join('/')
  const pathnameWithout = rest ? `/${rest}` : '/'
  return {
    locale: maybeLocale,
    pathname:
      pathnameWithout.length > 1 && pathnameWithout.endsWith('/')
        ? pathnameWithout.slice(0, -1)
        : pathnameWithout,
  }
}

/** Path without locale prefix (for pageKey / redirect lookup / offline allowlists). */
export function pathnameWithoutLocale(pathname: string): string {
  return stripLocalePrefix(pathname).pathname
}

/** Prefix a site-relative path with a locale (`localePrefix: always`). */
export function withLocalePrefix(pathname: string, locale: AppLocale = DEFAULT_LOCALE): string {
  const path = pathnameWithoutLocale(pathname)
  if (path === '/') return `/${locale}`
  return `/${locale}${path.startsWith('/') ? path : `/${path}`}`
}

/** True when the first segment is a known locale (or path is bare `/`). */
export function hasLocalePrefix(pathname: string): boolean {
  return stripLocalePrefix(pathname).locale != null
}
