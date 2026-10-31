import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

import { auth } from '@/core/auth'
import { roleFromUser, userIsAppAdmin } from '@/core/auth/admin'

export const dynamic = 'force-dynamic'

/** Who am I — Starforge core app session (not Payload CMS). */
export async function GET() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 })
  }

  const role = roleFromUser(session.user)
  const isAdmin = userIsAppAdmin(session.user)

  return NextResponse.json({
    authenticated: true,
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      emailVerified: session.user.emailVerified,
      image: session.user.image ?? null,
      role,
      banned: Boolean((session.user as { banned?: boolean }).banned),
      isAdmin,
      createdAt: session.user.createdAt,
    },
    session: {
      id: session.session.id,
      expiresAt: session.session.expiresAt,
    },
  })
}
