import { NextRequest, NextResponse } from 'next/server'
import { getFieldsToSign, getPayload, jwtSign } from 'payload'

import config from '@payload-config'
import { auth } from '@/core/auth'
import { ensurePayloadCmsUser, loadCoreUserCmsAccess } from '@/core/cms-bridge'
import { PAYLOAD_TOKEN_COOKIE } from '@/core/cms-bridge/payload-session'
import { safeNextPath } from '@/core/auth/safe-next-path'

/**
 * Exchange a Better Auth session for a Payload JWT cookie, then redirect to /admin.
 * Must be a Route Handler — Next.js only allows Set-Cookie here (not in RSC pages).
 */
export async function GET(request: NextRequest) {
  const next = safeNextPath(request.nextUrl.searchParams.get('next'), '/admin')
  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('next', next)

  const session = await auth.api.getSession({
    headers: request.headers,
    query: { disableRefresh: true },
  })
  if (!session?.user?.id) {
    return NextResponse.redirect(loginUrl)
  }

  const access = await loadCoreUserCmsAccess(session.user.id)
  if (!access?.cmsAccess || access.banned) {
    const denied = new URL('/', request.url)
    denied.searchParams.set('notice', 'cms-denied')
    return NextResponse.redirect(denied)
  }

  const ensured = await ensurePayloadCmsUser({
    coreUserId: session.user.id,
    email: session.user.email,
    name: session.user.name,
  })
  if (!ensured.ok) {
    console.error('[cms/exchange] ensure user failed:', ensured.error)
    const denied = new URL('/', request.url)
    denied.searchParams.set('notice', 'cms-denied')
    return NextResponse.redirect(denied)
  }

  const payload = await getPayload({ config })
  const collection = payload.collections.users
  if (!collection?.config.auth) {
    return NextResponse.redirect(new URL('/?notice=cms-denied', request.url))
  }

  const user = await payload.findByID({
    collection: 'users',
    id: ensured.id,
    depth: 0,
    overrideAccess: true,
  })
  if (!user?.email) {
    return NextResponse.redirect(new URL('/?notice=cms-denied', request.url))
  }

  const fieldsToSign = getFieldsToSign({
    collectionConfig: collection.config,
    email: user.email,
    user,
  })
  const tokenExpiration = collection.config.auth.tokenExpiration || 7200
  const { token } = await jwtSign({
    fieldsToSign,
    secret: payload.secret,
    tokenExpiration,
  })

  const dest = new URL(next, request.url)
  // Mark exchange complete so the admin page does not bounce again.
  if (dest.pathname.startsWith('/admin')) {
    dest.searchParams.set('cms', '1')
  }

  const response = NextResponse.redirect(dest)
  response.cookies.set(PAYLOAD_TOKEN_COOKIE, token, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: false,
    maxAge: tokenExpiration,
  })
  return response
}
