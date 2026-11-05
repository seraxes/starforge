import { isAppLocale, type AppLocale } from '@/core/i18n/locales'
import { pathnameWithoutLocale, withLocalePrefix } from '@/core/i18n/path'

/**
 * Redirect policy (i18n P2):
 * - Store **path-relative** from/to without locale prefixes (`/old` → `/new`).
 * - No per-locale redirect trees — one rule covers `/en/old` and `/hu/old`.
 * - At request time, match the bare path and re-prefix the destination with the
 *   **current request locale** (see `src/proxy.ts` `maybeRedirect`).
 * - Accidental `/en/…` input is stripped to bare on normalize.
 */

/**
 * Normalize a visitor path or redirect "from" for exact middleware match.
 * - Ensures leading `/`
 * - Strips query/hash
 * - Collapses duplicate slashes
 * - Drops trailing slash except for `/`
 * - Strips a leading `/{locale}` segment (path-relative policy)
 */
export function normalizeRedirectFromPath(raw: string): string {
  let path = (raw || '').trim()
  if (!path) return ''

  // Absolute URLs → pathname only for "from" matching.
  if (/^https?:\/\//i.test(path)) {
    try {
      path = new URL(path).pathname
    } catch {
      return ''
    }
  }

  const q = path.indexOf('?')
  if (q >= 0) path = path.slice(0, q)
  const h = path.indexOf('#')
  if (h >= 0) path = path.slice(0, h)

  if (!path.startsWith('/')) path = `/${path}`
  path = path.replace(/\/{2,}/g, '/')

  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1)
  }

  // Reject empty / control chars / backslashes.
  if (!path || path.includes('\\') || /[\u0000-\u001f]/.test(path)) return ''

  // Path-relative: drop accidental locale prefix so `/en/about` → `/about`.
  return pathnameWithoutLocale(path)
}

/**
 * Normalize redirect destination.
 * Relative paths get the same slash rules as from (locale stripped);
 * absolute http(s) URLs pass through unchanged (no locale rewrite).
 */
export function normalizeRedirectToPath(raw: string): string {
  const trimmed = (raw || '').trim()
  if (!trimmed) return ''

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed)
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
      return url.toString()
    } catch {
      return ''
    }
  }

  // Protocol-relative or dangerous schemes rejected.
  if (trimmed.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return ''
  }

  return normalizeRedirectFromPath(trimmed)
}

/**
 * Prefix a relative redirect destination with the request locale.
 * Absolute http(s) destinations are unchanged.
 */
export function resolveLocaleAwareRedirectPath(
  to: string,
  locale: AppLocale | string | null | undefined,
): string {
  if (/^https?:\/\//i.test(to)) return to
  const loc: AppLocale = isAppLocale(locale) ? locale : 'en'
  return withLocalePrefix(pathnameWithoutLocale(to), loc)
}

/** Build NextResponse.redirect target from stored to + request origin. */
export function resolveRedirectDestination(to: string, requestOrigin: string): string {
  if (/^https?:\/\//i.test(to)) return to
  const origin = requestOrigin.replace(/\/$/, '')
  const path = to.startsWith('/') ? to : `/${to}`
  return `${origin}${path}`
}
