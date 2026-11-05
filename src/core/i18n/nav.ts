import { isExternalHref, normalizeHref } from '@/core/settings/nav'

import { DEFAULT_LOCALE, isAppLocale, type AppLocale } from './locales'
import { pathnameWithoutLocale, withLocalePrefix } from './path'

/**
 * Locale-aware href for Nav / Menu items (P2).
 * Stores and CMS nav keep bare paths (`/about`); public links get `/{locale}/…`.
 * External / mailto / tel pass through unchanged.
 */
export function navHref(href: string, locale: AppLocale = DEFAULT_LOCALE): string {
  const raw = (href || '').trim()
  if (!raw) return withLocalePrefix('/', locale)
  if (isExternalHref(raw)) return raw
  return withLocalePrefix(normalizeHref(raw), locale)
}

/**
 * Active-state match that ignores the current locale prefix.
 * Works with both next-intl (bare) and next/navigation (prefixed) pathnames.
 */
export function isLocaleAwareNavItemActive(pathname: string, href: string): boolean {
  if (isExternalHref(href)) return false
  const path = pathnameWithoutLocale(pathname.split('?')[0]?.split('#')[0] || '/')
  const target = pathnameWithoutLocale(normalizeHref(href).split('?')[0]?.split('#')[0] || '/')
  if (target === '/') return path === '/'
  return path === target || path.startsWith(`${target}/`)
}

/** Coerce an unknown locale string to AppLocale (fallback default). */
export function coerceAppLocale(value: unknown): AppLocale {
  return isAppLocale(value) ? value : DEFAULT_LOCALE
}
