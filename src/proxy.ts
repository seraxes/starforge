import createMiddleware from 'next-intl/middleware'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { isPayloadAdminPath, PAYLOAD_ADMIN_BASE } from '@/core/admin-paths'
import {
  adminSessionCookieNames,
  publicSessionCookieNames,
} from '@/core/auth/admin-session'
import {
  DEFAULT_LOCALE,
  LOCALES,
  pathnameWithoutLocale,
} from '@/core/i18n'
import { getLocalizationSettings } from '@/core/localization/store'
import type { CspSources } from '@/core/security/csp'
import { getCachedFeatureCspSources } from '@/core/security/feature-sources-cached'
import { applySecurityHeaders } from '@/core/security/headers'
import {
  SITE_NOT_FOUND_PATH,
  SITE_OFFLINE_PATH,
  SITE_OFFLINE_RETRY_AFTER_SECONDS,
  getSiteChromeForProxy,
  isOfflineExemptPath,
} from '@/core/site-chrome'
import { runProxyHooks } from '@/generated/module-registry.server'

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

/** Reuse next-intl middleware when the enabled locale set has not changed. */
let cachedI18nHandler: {
  key: string
  handle: (request: NextRequest) => NextResponse
} | null = null

async function handleI18nRouting(request: NextRequest): Promise<NextResponse> {
  const { locales, defaultLocale } = await loadPublicLocales()
  const key = `${defaultLocale}\0${locales.join(',')}`
  if (!cachedI18nHandler || cachedI18nHandler.key !== key) {
    cachedI18nHandler = {
      key,
      // Dynamic locale list from Localization admin (wider than bootstrap routing types).
      handle: createMiddleware({
        locales,
        defaultLocale,
        localePrefix: 'always',
      } as never),
    }
  }
  return cachedI18nHandler.handle(request)
}

function finalize(response: NextResponse, cspSources?: CspSources | null): NextResponse {
  applySecurityHeaders(response.headers, { cspSources })
  return response
}

/** Public Better Auth cookie (member site). */
function hasPublicSession(request: NextRequest): boolean {
  return publicSessionCookieNames().some((name) => request.cookies.has(name))
}

/** Staff backend session cookie. */
function hasAdminSession(request: NextRequest): boolean {
  return adminSessionCookieNames().some((name) => request.cookies.has(name))
}

function hasPayloadToken(request: NextRequest): boolean {
  return request.cookies.has('payload-token')
}

/**
 * Stamp public pathname for Server Components (outline / pageKey resolve).
 *
 * Important: when composing over next-intl’s `next()`, do **not** copy its
 * `x-middleware-override-headers` / `x-middleware-request-*` onto our response —
 * that wiped our pathname overrides and every page fell back to `/{locale}`
 * → preferred Default outline → Main `data-sf-container="full"`.
 */
function withPathnameHeader(
  request: NextRequest,
  pathname: string,
  base?: NextResponse,
): NextResponse {
  const requestHeaders = new Headers(request.headers)

  // Keep next-intl request header mutations (locale, etc.), then add pathname.
  if (base) {
    const override = base.headers.get('x-middleware-override-headers')
    if (override) {
      for (const rawName of override.split(',')) {
        const name = rawName.trim()
        if (!name) continue
        const value = base.headers.get(`x-middleware-request-${name}`)
        if (value !== null) requestHeaders.set(name, value)
      }
    }
  }

  requestHeaders.set('x-sf-pathname', pathname)
  requestHeaders.set('x-sf-pathname-bare', pathnameWithoutLocale(pathname))

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })

  // Preserve next-intl cookies / link / rewrite — never clobber our request overrides.
  if (base) {
    base.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie)
    })
    base.headers.forEach((value, key) => {
      const lower = key.toLowerCase()
      if (lower === 'set-cookie') return
      if (lower === 'x-middleware-override-headers') return
      if (lower.startsWith('x-middleware-request-')) return
      if (lower.startsWith('x-middleware-') || lower === 'link') {
        response.headers.set(key, value)
      }
    })
  }

  return response
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
  if (pathname === SITE_NOT_FOUND_PATH || pathname.startsWith(`${SITE_NOT_FOUND_PATH}/`)) {
    return true
  }
  if (pathname === '/robots.txt') return true
  if (pathname === '/sitemap.xml' || pathname.startsWith('/sitemap')) return true
  if (pathname === '/manifest.webmanifest') return true
  if (pathname === '/sw.js' || pathname.startsWith('/sw.js')) return true
  return false
}

/**
 * App Router data fetches (`rsc: 1`) must stay HTTP 200.
 * A 503 flight is not a valid RSC payload — Next hard-navigates (`location.assign`)
 * to the same URL, which 503s again, and the page reloads forever.
 * Full document loads still get 503 + Retry-After for crawlers.
 */
function isAppRouterFlight(request: NextRequest): boolean {
  const headers = request.headers
  if (headers.get('rsc') === '1') return true
  if (headers.get('next-router-prefetch')) return true
  if (headers.get('next-router-state-tree')) return true
  if (headers.get('next-hmr-refresh') === '1') return true
  // Flight fetches use Sec-Fetch-Dest: empty; document navigations use "document".
  return (headers.get('sec-fetch-dest') || '').toLowerCase() === 'empty'
}

/**
 * Site Chrome offline gate — process snapshot / uncached DB (no published-content cache).
 * Same for everyone (no admin bypass). `/admin`, auth, API stay open via exempt paths.
 */
async function maybeRewriteOffline(request: NextRequest): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl
  if (isOfflineExemptPath(pathname)) return null

  try {
    const chrome = await getSiteChromeForProxy()
    if (!chrome.offlineEnabled) return null

    const rewriteUrl = request.nextUrl.clone()
    rewriteUrl.pathname = SITE_OFFLINE_PATH
    rewriteUrl.search = ''
    const flight = isAppRouterFlight(request)
    const response = flight
      ? NextResponse.rewrite(rewriteUrl)
      : NextResponse.rewrite(rewriteUrl, { status: 503 })
    if (!flight) {
      response.headers.set('Retry-After', String(SITE_OFFLINE_RETRY_AFTER_SECONDS))
    }
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch {
    return null
  }
}

/**
 * Apply public policy (module proxy hooks → offline → pathname + CSP) onto a
 * next-intl response or a plain next() for non-localized routes.
 * Redirects run inside `runProxyHooks` (generated). Sitemap stays exempt there.
 */
async function finalizePublic(
  request: NextRequest,
  base?: NextResponse,
): Promise<NextResponse> {
  const redirected = await runProxyHooks(request)
  if (redirected) return redirected

  // Offline before CSP — never await published-content cache on the 503 path
  // (`revalidateTag({ expire: 0 })` can stall until process restart).
  const offline = await maybeRewriteOffline(request)
  if (offline) {
    return finalize(offline, {} as CspSources)
  }

  const cspSources = await getCachedFeatureCspSources().catch(() => ({} as CspSources))
  return finalize(
    withPathnameHeader(request, request.nextUrl.pathname, base),
    cspSources,
  )
}

/**
 * Next.js 16 Node `proxy` (replaces deprecated Edge `middleware`).
 *
 * Order: Payload SSO → skip locale for admin/cms/api → next-intl locale negotiation
 * early on public paths → module proxy hooks → offline 503 → pathname header + feature CSP.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  // Payload CMS admin — SSO exchange gate (not Core `/admin`).
  if (isPayloadAdminPath(pathname)) {
    const admin = hasAdminSession(request)
    const publicBa = hasPublicSession(request)
    const token = hasPayloadToken(request)
    const nextPath = `${pathname}${search || ''}`
    const destPath = nextPath.startsWith(`${PAYLOAD_ADMIN_BASE}/login`)
      ? PAYLOAD_ADMIN_BASE
      : nextPath
    const loginDest = new URL(
      `/login?next=${encodeURIComponent(
        nextPath.startsWith(`${PAYLOAD_ADMIN_BASE}/login`) ? PAYLOAD_ADMIN_BASE : nextPath,
      )}`,
      request.url,
    )
    const mintDest = new URL(
      `/api/auth/admin-session?next=${encodeURIComponent(destPath)}`,
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

    if (!admin && !publicBa) {
      return finalize(NextResponse.redirect(loginDest))
    }

    // Public staff session alone → mint backend cookie before CMS exchange.
    if (!admin && publicBa) {
      return finalize(NextResponse.redirect(mintDest))
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
    // Skip static assets + Serwist SW (product:pwa) so workers register without locale rewrite.
    '/((?!_next/static|_next/image|favicon.ico|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
