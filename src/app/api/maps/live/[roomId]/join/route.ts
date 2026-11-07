import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

import { auth } from '@/core/auth'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { mapTeamChannel } from '@/modules/maps/channels'
import {
  findMapRoomById,
  findMembershipForUserInRoom,
  joinMapSession,
  userIsRoomManager,
} from '@/modules/maps/store'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ roomId: string }> }

/** Join live map session (explicit consent). Roster required (or room manager). */
export async function POST(request: Request, context: Ctx) {
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
  if (!room || !room.active) {
    return NextResponse.json({ error: 'Room not available' }, { status: 404 })
  }

  let body: { consent?: boolean } = {}
  try {
    body = (await request.json()) as { consent?: boolean }
  } catch {
    body = {}
  }
  if (!body.consent) {
    return NextResponse.json(
      { error: 'Consent required to share location' },
      { status: 400 },
    )
  }

  const membership = await findMembershipForUserInRoom(room.id, session.user.id)
  if (!membership) {
    const manager = await userIsRoomManager(room, session.user.id)
    if (!manager) {
      return NextResponse.json(
        { error: 'Not on roster for this map' },
        { status: 403 },
      )
    }
    return NextResponse.json(
      { error: 'Room managers must be placed on a team roster to join live tracking' },
      { status: 403 },
    )
  }

  const live = await joinMapSession({
    roomId: room.id,
    teamId: membership.team.id,
    userId: session.user.id,
  })

  return NextResponse.json({
    sessionId: live.id,
    roomId: room.id,
    teamId: membership.team.id,
    teamName: membership.team.name,
    teamColor: membership.team.color,
    channel: mapTeamChannel(room.id, membership.team.id),
  })
}
