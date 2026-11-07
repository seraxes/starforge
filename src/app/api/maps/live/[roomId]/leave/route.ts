import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

import { auth } from '@/core/auth'
import { getRealtimePort } from '@/core/realtime'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { mapTeamChannel } from '@/modules/maps/channels'
import {
  findActiveSession,
  findMapRoomById,
  leaveActiveSessionForUser,
} from '@/modules/maps/store'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ roomId: string }> }

/** Leave live map — stops session and clears last position. */
export async function POST(_request: Request, context: Ctx) {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.maps)) {
    return NextResponse.json({ error: 'Maps disabled' }, { status: 404 })
  }

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { roomId } = await context.params
  const room = await findMapRoomById(roomId)
  if (!room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  }

  const active = await findActiveSession(room.id, session.user.id)
  const left = await leaveActiveSessionForUser(room.id, session.user.id)

  if (active) {
    try {
      await getRealtimePort().publish(
        mapTeamChannel(active.roomId, active.teamId),
        'map.position.clear',
        { userId: session.user.id },
      )
    } catch {
      // realtime optional
    }
  }

  return NextResponse.json({ ok: true, left })
}
