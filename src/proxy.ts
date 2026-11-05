import createMiddleware from 'next-intl/middleware'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { isPayloadAdminPath, PAYLOAD_ADMIN_BASE } from '@/core/admin-paths'
import { auth } from '@/core/auth'
import { userIsAppAdmin } from '@/core/auth/admin'
import {
  DEFAULT_LOCALE,
  LOCALES,
  pathnameWithoutLocale,
  stripLocalePrefix,
} from '@/core/i18n'
import { getLocalizationSettings } from '@/core/localization/store'
import {
  lookupEnabledRedirect,
  normalizeRedirectFromPath,
  resolveLocaleAwareRedirectPath,
} from '@/core/redirects'
import type { CspSources } from '@/core/security/csp'
import { getCachedFeatureCspSources } from '@/core/security/feature-sources-cached'
import { applySecurityHeaders } from '@/core/security/headers'
import {
  MODULE_IDS,
  getSiteSettings,
  isCatalogModuleEnabled,
} from '@/core/settings'
import {
  SITE_OFFLINE_PATH,
  getSiteChrome,
  isOfflineExemptPath,
} from '@/core/site-chrome'

/**
 * next-intl middleware using Localization admin enabled locales (P2).
 * Falls open to bootstrap `en`/`hu` when settings are unavailable.
 */
async function loadPublicLocales(): Promise<{
  locales: string[]
  defaultLocale: string
}> {
  let locales: string[] = [...LOCALES]
  let defaultLocale: string = DEFAULT_LOCALE
  try {
    const { registerPublicLocaleCodes } = await import('@/core/i18n/locales')
    const settings = await getLocalizationSettings()
    registerPublicLocaleCodes(settings.localeCatalog.map((e) => e.code))
    if (settings.localesEnabled.length > 0) {
      locales = [...settings.localesEnabled]
    }
    if (settings.defaultLocale) {
      defaultLocale = settings.defaultLocale
    }
  } catch {
    // fail open to bootstrap
  }
  return { locales, defaultLocale }
}

async function handleI18nRouting(request: NextRequest): Promise<NextResponse> {
  const { locales, defaultLocale } = await loadPublicLocales()

  // Dynamic locale list from Localization admin (wider than bootstrap routing types).
  return createMiddleware({
    locales,
    defaultLocale,
    localePrefix: 'always',
  } as never)(request)
}

function finalize(response: NextResponse, cspSources?: CspSources | null): NextResponse {
  applySecurityHeaders(response.headers, { cspSources })
  return response
}

function hasBetterAuthSession(request: NextRequest): boolean {
  return (
    request.cookies.has('better-auth.session_token') ||
    request.cookies.has('__Secure-better-auth.session_token')
  )
}

function hasPayloadToken(request: NextRequest): boolean {
  return request.cookies.has('payload-token')
}

function withPathnameHeader(
  request: NextRequest,
  pathname: string,
  base?: NextResponse,
): NextResponse {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-sf-pathname', pathname)
  requestHeaders.set('x-sf-pathname-bare', pathnameWithoutLocale(pathname))
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })

  // Preserve next-intl cookies / link headers when composing over its `next()`.
  if (base) {
    base.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie)
    })
    base.headers.forEach((value, key) => {
      const lower = key.toLowerCase()
      if (lower === 'set-cookie') return
      if (lower.startsWith('x-middleware-')) {
        response.headers.set(key, value)
        return
      }
      if (lower === 'link') {
        response.headers.set(key, value)
      }
    })
  }

  return response
}

function isRedirectLookupExemptPath(pathname: string): boolean {
  if (pathname.startsWith('/api/')) return true
  if (pathname.startsWith('/cms')) return true
  if (pathname.startsWith('/admin')) return true
  if (pathname.startsWith('/_next/')) return true
  if (pathname === '/sitemap.xml' || pathname.startsWith('/sitemap')) return true
  if (pathname === '/robots.txt') return true
  return false
}

/** Paths that stay outside `[locale]` (no next-intl negotiation). */
function isNonLocalizedPath(pathname: string): boolean {
  if (pathname.startsWith('/api')) return true
  if (pathname.startsWith('/admin')) return true
  if (pathname.startsWith('/cms')) return true
  if (pathname.startsWith('/_next')) return true
  if (pathname === SITE_OFFLINE_PATH || pathname.startsWith(`${SITE_OFFLINE_PATH}/`)) {
    return true
  }
  if (pathname === '/robots.txt') return true
  if (pathname === '/sitemap.xml' || pathname.startsWith('/sitemap')) return true
  return false
}

/**
 * product:redirects — in-process lookup (Node proxy; no internal HTTP hop).
 * Match stored paths without locale; re-prefix destination with the request locale.
 * Fail-open when the module is off or the store errors.
 */
async function maybeRedirect(request: NextRequest): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl
  if (isRedirectLookupExemptPath(pathname)) return null

  try {
    const settings = await getSiteSettings()
    if (!isCatalogModuleEnabled(settings, MODULE_IDS.redirects)) return null

    // Ensure admin-added locale prefixes strip correctly for bare-path lookup.
    await loadPublicLocales()
    const { locale, pathname: barePath } = stripLocalePrefix(pathname)
    const fromPath = normalizeRedirectFromPath(barePath)
    if (!fromPath) return null
    const hit = await lookupEnabledRedirect(fromPath)
    if (!hit) return null

    const status =
      hit.status === 301 || hit.status === 302 || hit.status === 307 || hit.status === 308
        ? hit.status
        : 301

    let destination: URL
    if (/^https?:\/\//i.test(hit.to)) {
      destination = new URL(hit.to)
    } else {
      destination = request.nextUrl.clone()
      // Path-relative policy: re-prefix with the current request locale (P2).
      destination.pathname = resolveLocaleAwareRedirectPath(
        hit.to,
        locale ?? DEFAULT_LOCALE,
      )
      destination.search = ''
      destination.hash = ''
    }

    if (
      destination.origin === request.nextUrl.origin &&
      destination.pathname === pathname
    ) {
      return null
    }

    return NextResponse.redirect(destination, status)
  } catch {
    return null
  }
}

/**
 * Site Chrome offline gate — in-process via cached getSiteChrome (no HTTP hop).
 * Admins bypass using the Better Auth session on the incoming request.
 */
async function maybeRewriteOffline(request: NextRequest): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl
  if (isOfflineExemptPath(pathname)) return null

  try {
    const chrome = await getSiteChrome()
    if (!chrome.offlineEnabled) return null

    const session = await auth.api.getSession({ headers: request.headers })
    if (userIsAppAdmin(session?.user)) return null

    const rewriteUrl = request.nextUrl.clone()
    rewriteUrl.pathname = SITE_OFFLINE_PATH
    rewriteUrl.search = ''
    return NextResponse.rewrite(rewriteUrl)
  } catch {
    return null
  }
}

/**
 * Apply public policy (redirects → offline → pathname + CSP) onto a next-intl response
 * or a plain next() for non-localized routes.
 */
async function finalizePublic(
  request: NextRequest,
  base?: NextResponse,
): Promise<NextResponse> {
  const redirected = await maybeRedirect(request)
  if (redirected) return redirected

  const cspSources = await getCachedFeatureCspSources().catch(() => ({} as CspSources))
  const offline = await maybeRewriteOffline(request)
  if (offline) return finalize(offline, cspSources)

  return finalize(
    withPathnameHeader(request, request.nextUrl.pathname, base),
    cspSources,
  )
}

/**
 * Next.js 16 Node `proxy` (replaces deprecated Edge `middleware`).
 *
 * Order: Payload SSO → skip locale for admin/cms/api → next-intl locale negotiation
 * early on public paths → redirects → offline 503 → pathname header + feature CSP.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  // Payload CMS admin — SSO exchange gate (not Core `/admin`).
  if (isPayloadAdminPath(pathname)) {
    const ba = hasBetterAuthSession(request)
    const token = hasPayloadToken(request)
    const nextPath = `${pathname}${search || ''}`
    const loginDest = new URL(
      `/login?next=${encodeURIComponent(
        nextPath.startsWith(`${PAYLOAD_ADMIN_BASE}/login`) ? PAYLOAD_ADMIN_BASE : nextPath,
      )}`,
      request.url,
    )
    const exchangeDest = new URL(
      `/api/cms/exchange?next=${encodeURIComponent(
        pathname.startsWith(`${PAYLOAD_ADMIN_BASE}/login`) ||
          pathname.startsWith(`${PAYLOAD_ADMIN_BASE}/create-first-user`)
          ? PAYLOAD_ADMIN_BASE
          : nextPath,
      )}`,
      request.url,
    )

    if (!ba) {
      return finalize(NextResponse.redirect(loginDest))
    }

    if (
      pathname === `${PAYLOAD_ADMIN_BASE}/login` ||
      pathname.startsWith(`${PAYLOAD_ADMIN_BASE}/login/`) ||
      pathname === `${PAYLOAD_ADMIN_BASE}/create-first-user` ||
      pathname.startsWith(`${PAYLOAD_ADMIN_BASE}/create-first-user/`)
    ) {
      return finalize(NextResponse.redirect(exchangeDest))
    }

    if (!token) {
      return finalize(NextResponse.redirect(exchangeDest))
    }

    return finalize(NextResponse.next())
  }

  if (isNonLocalizedPath(pathname)) {
    if (pathname.startsWith('/api')) {
      return finalize(NextResponse.next())
    }
    return finalizePublic(request)
  }

  // Locale negotiation early (prefix always: `/` → `/en`, etc.).
  // Enabled locales come from Localization admin (catalog + enable list).
  const i18nResponse = await handleI18nRouting(request)
  if (i18nResponse.headers.get('location')) {
    // Redirect/rewrite from next-intl — apply security headers and return.
    return finalize(i18nResponse)
  }

  return finalizePublic(request, i18nResponse)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
