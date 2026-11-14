import { NextRequest, NextResponse } from 'next/server'

import {
  listGroupIdsForUser,
  viewerMayEnterAdminShell,
  type AccessViewer,
} from '@/core/acl'
import {
  getAdminSession,
  getPublicSessionForMint,
  hasAdminSessionCookie,
  mintAdminSessionCookie,
} from '@/core/auth/admin-session'
import { promoteSessionUserIfBootstrapAdmin, userIsAppAdmin } from '@/core/auth/admin'
import { safeNextPath } from '@/core/auth/safe-next-path'

/**
 * Mint a staff backend session cookie from the public Better Auth session, then
 * redirect to `next` (default `/admin`). Route Handler required for Set-Cookie.
 */
export async function GET(request: NextRequest) {
  const next = safeNextPath(request.nextUrl.searchParams.get('next'), '/admin')
  const loginUrl = new URL('/admin/login', request.url)
  loginUrl.searchParams.set('next', next)

  if (hasAdminSessionCookie(request.headers.get('cookie'))) {
    const existing = await getAdminSession()
    if (existing?.user?.id) {
      return NextResponse.redirect(new URL(next, request.url))
    }
  }

  const publicSession = await getPublicSessionForMint()
  if (!publicSession?.user?.id) {
    return NextResponse.redirect(loginUrl)
  }

  await promoteSessionUserIfBootstrapAdmin(publicSession.user)

  const viewer: AccessViewer = {
    userId: publicSession.user.id,
    isRegistered: true,
    isAppAdmin: userIsAppAdmin(publicSession.user),
    groupIds: await listGroupIdsForUser(publicSession.user.id),
  }

  if (!(await viewerMayEnterAdminShell(viewer))) {
    const denied = new URL('/', request.url)
    denied.searchParams.set('notice', 'admins-only')
    return NextResponse.redirect(denied)
  }

  const minted = await mintAdminSessionCookie({
    userId: publicSession.user.id,
    next,
  })
  if (!minted.ok) {
    const denied = new URL('/', request.url)
    denied.searchParams.set('notice', 'admins-only')
    return NextResponse.redirect(denied)
  }

  return NextResponse.redirect(new URL(minted.next, request.url))
}
