import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

import { auth } from '@/core/auth'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import {
  findActiveSession,
  findMapRoomById,
  findMembershipForUserInRoom,
  isPositionStale,
  listTeamPositions,
  MAP_POSITION_STALE_MS,
  userIsRoomManager,
} from '@/modules/maps/store'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ roomId: string }> }

/** Same-team position snapshot (ACL filtered). */
export async function GET(_request: Request, context: Ctx) {
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

  const membership = await findMembershipForUserInRoom(room.id, session.user.id)
  const active = await findActiveSession(room.id, session.user.id)
  const manager = await userIsRoomManager(room, session.user.id)

  const teamId = active?.teamId || membership?.team.id
  if (!teamId && !manager) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!teamId) {
    return NextResponse.json({ positions: [] })
  }

  // Managers only see a team if they are on roster / in session (same-team rule).
  if (!membership && !active) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const positions = await listTeamPositions(teamId)
  const now = Date.now()
  return NextResponse.json({
    positions: positions.map((p) => ({
      userId: p.userId,
      latitude: p.latitude,
      longitude: p.longitude,
      accuracy: p.accuracy,
      heading: p.heading,
      updatedAt: p.updatedAt.toISOString(),
      stale: isPositionStale(p.updatedAt, now, MAP_POSITION_STALE_MS),
    })),
  })
}
