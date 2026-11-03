import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import {
  SITE_OFFLINE_PATH,
  isOfflineExemptPath,
} from '@/core/site-chrome/offline'

/** Paths that skip SEO redirect lookup (same family as offline exempt + sitemap). */
function isRedirectLookupExempt(pathname: string): boolean {
  if (isOfflineExemptPath(pathname)) return true
  if (pathname === '/robots.txt' || pathname === '/sitemap.xml') return true
  if (pathname.startsWith('/sitemap')) return true
  return false
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

/**
 * product:redirects — Edge-safe lookup via Node API (Drizzle stays off the Edge).
 * Runs before offline rewrite so /old → /new still works while the site is up.
 */
async function maybeRedirect(request: NextRequest): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl
  if (isRedirectLookupExempt(pathname)) return null

  try {
    const lookupUrl = new URL('/api/redirects/lookup', request.url)
    lookupUrl.searchParams.set('path', pathname)
    const lookupRes = await fetch(lookupUrl, {
      headers: {
        cookie: request.headers.get('cookie') ?? '',
      },
      cache: 'no-store',
    })
    if (!lookupRes.ok) return null
    const data = (await lookupRes.json()) as {
      match?: { to?: string; status?: number } | null
    }
    const match = data.match
    if (!match?.to || typeof match.to !== 'string') return null

    const status = match.status === 302 ? 302 : 301
    const target = match.to.trim()
    if (!target) return null

    // Absolute target
    if (/^https?:\/\//i.test(target)) {
      return NextResponse.redirect(target, status)
    }

    // Site-relative path
    const dest = request.nextUrl.clone()
    const pathOnly = target.startsWith('/') ? target : `/${target}`
    const q = pathOnly.indexOf('?')
    if (q >= 0) {
      dest.pathname = pathOnly.slice(0, q) || '/'
      dest.search = pathOnly.slice(q)
    } else {
      dest.pathname = pathOnly || '/'
      dest.search = ''
    }
    dest.hash = ''
    return NextResponse.redirect(dest, status)
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
 * SEO redirects (product:redirects) → 301/302 before offline gate.
 * Site Chrome offline → rewrite public HTML to 503.
 * Also: never let Payload render `/admin/login` (stock email/password form).
 * Core Better Auth is the only sign-in; `/api/cms/exchange` mints `payload-token`.
 */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  // Public + app routes: redirects → offline gate (HTML) + pathname for RSC layouts.
  if (!pathname.startsWith('/admin') && !pathname.startsWith('/api')) {
    const redirected = await maybeRedirect(request)
    if (redirected) return redirected
    const offline = await maybeRewriteOffline(request)
    if (offline) return offline
    return withPathnameHeader(request, pathname)
  }

  if (!pathname.startsWith('/admin')) {
    return NextResponse.next()
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
    return NextResponse.redirect(loginDest)
  }

  // Stock Payload login / create-first-user must never render.
  if (
    pathname === '/admin/login' ||
    pathname.startsWith('/admin/login/') ||
    pathname === '/admin/create-first-user' ||
    pathname.startsWith('/admin/create-first-user/')
  ) {
    return NextResponse.redirect(exchangeDest)
  }

  // Have Better Auth but no Payload JWT → exchange.
  if (!token) {
    return NextResponse.redirect(exchangeDest)
  }

  return NextResponse.next()
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
