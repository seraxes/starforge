import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import type { CspSources } from '@/core/security/csp'
import { applySecurityHeaders } from '@/core/security/headers'
import {
  SITE_OFFLINE_PATH,
  isOfflineExemptPath,
} from '@/core/site-chrome/offline'

function finalize(response: NextResponse, cspSources?: CspSources | null): NextResponse {
  applySecurityHeaders(response.headers, { cspSources })
  return response
}

const CSP_SOURCES_TTL_MS = 15_000
const CSP_SOURCES_RETRY_MS = 5_000

let cspSourcesCache: { sources: CspSources; expiresAt: number } | null = null
let cspSourcesInflight: Promise<CspSources | null> | null = null

async function fetchFeatureCspSources(request: NextRequest): Promise<CspSources | null> {
  try {
    const res = await fetch(new URL('/api/security/csp-sources', request.url), {
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = (await res.json()) as { sources?: CspSources }
    return data.sources && typeof data.sources === 'object' ? data.sources : {}
  } catch {
    return null
  }
}

/**
 * Feature-driven CSP sources (Turnstile, Font Awesome, analytics, Page
 * Settings assets), cached per server instance so pages cost at most one
 * internal hop per TTL. On failure keep the last good set and retry soon.
 */
async function featureCspSources(request: NextRequest): Promise<CspSources | null> {
  if (cspSourcesCache && cspSourcesCache.expiresAt > Date.now()) {
    return cspSourcesCache.sources
  }
  cspSourcesInflight ??= fetchFeatureCspSources(request).finally(() => {
    cspSourcesInflight = null
  })
  const fresh = await cspSourcesInflight
  if (fresh) {
    cspSourcesCache = { sources: fresh, expiresAt: Date.now() + CSP_SOURCES_TTL_MS }
    return fresh
  }
  const stale = cspSourcesCache?.sources ?? {}
  cspSourcesCache = { sources: stale, expiresAt: Date.now() + CSP_SOURCES_RETRY_MS }
  return stale
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
  if (pathname.startsWith('/admin')) return true
  if (pathname.startsWith('/app/')) return true
  if (pathname.startsWith('/_next/')) return true
  if (pathname === '/sitemap.xml' || pathname.startsWith('/sitemap')) return true
  if (pathname === '/robots.txt') return true
  return false
}

/**
 * product:redirects — apply enabled from→to before offline / page render.
 * Fail-open when the lookup API is down or the module is off.
 */
async function maybeRedirect(request: NextRequest): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl
  if (isRedirectLookupExemptPath(pathname)) return null

  try {
    const lookupUrl = new URL('/api/redirects/lookup', request.url)
    lookupUrl.searchParams.set('path', pathname)
    const lookupRes = await fetch(lookupUrl, { cache: 'no-store' })
    if (!lookupRes.ok) return null
    const data = (await lookupRes.json()) as {
      hit?: boolean
      to?: string
      status?: number
    }
    if (!data.hit || typeof data.to !== 'string' || !data.to) return null

    const status =
      data.status === 301 ||
      data.status === 302 ||
      data.status === 307 ||
      data.status === 308
        ? data.status
        : 301

    let destination: URL
    if (/^https?:\/\//i.test(data.to)) {
      destination = new URL(data.to)
    } else {
      destination = request.nextUrl.clone()
      destination.pathname = data.to.startsWith('/') ? data.to : `/${data.to}`
      destination.search = ''
      destination.hash = ''
    }

    // Avoid redirect loops onto the same path.
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
 * When Site Chrome offline mode locks public HTML, rewrite to the 503 route
 * (URL stays the visitor path). Skips /api, /admin, /app, login, health, etc.
 */
async function maybeRewriteOffline(request: NextRequest): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl
  if (isOfflineExemptPath(pathname)) return null

  try {
    const gateUrl = new URL('/api/site-chrome/offline-gate', request.url)
    gateUrl.searchParams.set('path', pathname)
    const gateRes = await fetch(gateUrl, {
      headers: {
        cookie: request.headers.get('cookie') ?? '',
      },
      cache: 'no-store',
    })
    if (!gateRes.ok) return null
    const data = (await gateRes.json()) as { locked?: boolean }
    if (!data.locked) return null

    const rewriteUrl = request.nextUrl.clone()
    rewriteUrl.pathname = SITE_OFFLINE_PATH
    rewriteUrl.search = ''
    return NextResponse.rewrite(rewriteUrl)
  } catch {
    return null
  }
}

/**
 * Stash pathname for Page Settings chrome resolution (public layouts).
 * product:redirects lookup → Site Chrome offline 503 → continue.
 * Also: never let Payload render `/admin/login` (stock email/password form).
 * Core Better Auth is the only sign-in; `/api/cms/exchange` mints `payload-token`.
 */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  // Public + app routes: redirects → offline gate (HTML) + pathname for RSC layouts.
  // Only these render Page Settings chrome, so only they get feature CSP sources
  // (/api is skipped — the sources route itself would recurse).
  if (!pathname.startsWith('/admin') && !pathname.startsWith('/api')) {
    const redirected = await maybeRedirect(request)
    if (redirected) return redirected
    const cspSources = await featureCspSources(request)
    const offline = await maybeRewriteOffline(request)
    if (offline) return finalize(offline, cspSources)
    return finalize(withPathnameHeader(request, pathname), cspSources)
  }

  if (!pathname.startsWith('/admin')) {
    return finalize(NextResponse.next())
  }

  const ba = hasBetterAuthSession(request)
  const token = hasPayloadToken(request)
  const nextPath = `${pathname}${search || ''}`
  const loginDest = new URL(`/login?next=${encodeURIComponent(nextPath.startsWith('/admin/login') ? '/admin' : nextPath)}`, request.url)
  const exchangeDest = new URL(
    `/api/cms/exchange?next=${encodeURIComponent(pathname.startsWith('/admin/login') || pathname.startsWith('/admin/create-first-user') ? '/admin' : nextPath)}`,
    request.url,
  )

  // No core session → always core /login (never Payload login UI).
  if (!ba) {
    return finalize(NextResponse.redirect(loginDest))
  }

  // Stock Payload login / create-first-user must never render.
  if (
    pathname === '/admin/login' ||
    pathname.startsWith('/admin/login/') ||
    pathname === '/admin/create-first-user' ||
    pathname.startsWith('/admin/create-first-user/')
  ) {
    return finalize(NextResponse.redirect(exchangeDest))
  }

  // Have Better Auth but no Payload JWT → exchange.
  if (!token) {
    return finalize(NextResponse.redirect(exchangeDest))
  }

  return finalize(NextResponse.next())
}

export const config = {
  matcher: [
    /*
     * Page Settings pathname + offline 503 + Payload admin gate.
     * Skip Next internals and static files.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
