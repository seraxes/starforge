import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { isPayloadAdminPath, PAYLOAD_ADMIN_BASE } from '@/core/admin-paths'
import { auth } from '@/core/auth'
import { userIsAppAdmin } from '@/core/auth/admin'
import {
  lookupEnabledRedirect,
  normalizeRedirectFromPath,
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

function withPathnameHeader(request: NextRequest, pathname: string): NextResponse {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-sf-pathname', pathname)
  return NextResponse.next({
    request: { headers: requestHeaders },
  })
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

/**
 * product:redirects — in-process lookup (Node proxy; no internal HTTP hop).
 * Fail-open when the module is off or the store errors.
 */
async function maybeRedirect(request: NextRequest): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl
  if (isRedirectLookupExemptPath(pathname)) return null

  try {
    const settings = await getSiteSettings()
    if (!isCatalogModuleEnabled(settings, MODULE_IDS.redirects)) return null

    const fromPath = normalizeRedirectFromPath(pathname)
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
      destination.pathname = hit.to.startsWith('/') ? hit.to : `/${hit.to}`
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
 * Next.js 16 Node `proxy` (replaces deprecated Edge `middleware`).
 *
 * Public + Core `/admin`: redirects → offline 503 → pathname header + feature CSP.
 * Payload `/cms/admin`: Better Auth + payload-token exchange gate.
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

  if (pathname.startsWith('/api')) {
    return finalize(NextResponse.next())
  }

  const redirected = await maybeRedirect(request)
  if (redirected) return redirected
  const cspSources = await getCachedFeatureCspSources().catch(() => ({} as CspSources))
  const offline = await maybeRewriteOffline(request)
  if (offline) return finalize(offline, cspSources)
  return finalize(withPathnameHeader(request, pathname), cspSources)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
