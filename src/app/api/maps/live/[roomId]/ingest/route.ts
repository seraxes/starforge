import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

import { auth } from '@/core/auth'
import { getRealtimePort } from '@/core/realtime'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { mapTeamChannel } from '@/modules/maps/channels'
import {
  findActiveSession,
  findMapRoomById,
  upsertPosition,
} from '@/modules/maps/store'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ roomId: string }> }

type Body = {
  latitude?: number
  longitude?: number
  accuracy?: number | null
  heading?: number | null
}

/** Authenticated location ingest for an active map session. */
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

  const active = await findActiveSession(room.id, session.user.id)
  if (!active) {
    return NextResponse.json({ error: 'Not in a live session' }, { status: 409 })
  }

  let body: Body = {}
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const latitude = Number(body.latitude)
  const longitude = Number(body.longitude)
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 })
  }

  const accuracy =
    body.accuracy == null || !Number.isFinite(Number(body.accuracy))
      ? null
      : Number(body.accuracy)
  const heading =
    body.heading == null || !Number.isFinite(Number(body.heading))
      ? null
      : Number(body.heading)

  const position = await upsertPosition({
    session: active,
    latitude,
    longitude,
    accuracy,
    heading,
  })

  try {
    await getRealtimePort().publish(
      mapTeamChannel(active.roomId, active.teamId),
      'map.position',
      {
        userId: position.userId,
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy: position.accuracy,
        heading: position.heading,
        updatedAt: position.updatedAt.toISOString(),
      },
    )
  } catch {
    // ingest still succeeds without fanout
  }

  return NextResponse.json({ ok: true })
}
