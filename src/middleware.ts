import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

function hasBetterAuthSession(request: NextRequest): boolean {
  return (
    request.cookies.has('better-auth.session_token') ||
    request.cookies.has('__Secure-better-auth.session_token')
  )
}

function hasPayloadToken(request: NextRequest): boolean {
  return request.cookies.has('payload-token')
}

/**
 * Never let Payload render `/admin/login` (stock email/password form).
 * Core Better Auth is the only sign-in; `/api/cms/exchange` mints `payload-token`.
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl

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
  matcher: ['/admin', '/admin/:path*'],
}
