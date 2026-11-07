import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

import { auth } from '@/core/auth'
import { userIsAppAdmin } from '@/core/auth/admin'
import {
  getRealtimePort,
  getRealtimeRuntimeConfig,
  userChannel,
} from '@/core/realtime'

export const dynamic = 'force-dynamic'

/**
 * Dev / admin smoke: publish a test event to the caller's `user:{id}` channel.
 * Allowed when `NODE_ENV=development` or the session user is an app admin.
 */
export async function POST() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const isDev = process.env.NODE_ENV === 'development'
  const isAdmin = userIsAppAdmin(session.user)
  if (!isDev && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!getRealtimeRuntimeConfig().enabled) {
    return NextResponse.json(
      {
        error: 'Realtime disabled',
        hint: 'Enable RealtimePort under Settings → Performance.',
      },
      { status: 503 },
    )
  }

  const channel = userChannel(session.user.id)
  const event = await getRealtimePort().publish(channel, 'realtime.smoke', {
    source: 'api/realtime/smoke',
    userId: session.user.id,
  })

  return NextResponse.json({ ok: true, event })
}
