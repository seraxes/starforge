import React from 'react'

import { getAppSession } from '@/core/auth/session'
import { getMapProvider } from '@/core/maps'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import {
  findMapRoomByEventId,
  findMembershipForUserInRoom,
  listOverlaysForRoom,
  listTeamPositions,
  MAP_POSITION_STALE_MS,
  isPositionStale,
} from '../store'
import { LiveMapPanel } from './LiveMapPanel'

/** Embed live tactical map on event detail when a room exists. */
export async function EventLiveMap({ eventId }: { eventId: string }) {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.maps)) return null

  const room = await findMapRoomByEventId(eventId)
  if (!room || !room.active) return null

  const session = await getAppSession()
  const userId = session?.user?.id || ''
  const membership = userId
    ? await findMembershipForUserInRoom(room.id, userId)
    : null
  const overlays = await listOverlaysForRoom(room.id)
  const provider = await getMapProvider()

  let initialPositions: Array<{
    userId: string
    latitude: number
    longitude: number
    accuracy: number | null
    heading: number | null
    updatedAt: string
    stale: boolean
  }> = []

  if (membership) {
    const positions = await listTeamPositions(membership.team.id)
    const now = Date.now()
    initialPositions = positions.map((p) => ({
      userId: p.userId,
      latitude: p.latitude,
      longitude: p.longitude,
      accuracy: p.accuracy,
      heading: p.heading,
      updatedAt: p.updatedAt.toISOString(),
      stale: isPositionStale(p.updatedAt, now, MAP_POSITION_STALE_MS),
    }))
  }

  const point = overlays.find(
    (o) => o.kind === 'point' && o.latitude != null && o.longitude != null,
  )

  return (
    <section className="sf-event-live-map cms-block" aria-label="Live tactical map">
      <header className="sf-event-live-map-header">
        <h2 className="sf-event-live-map-heading">Live map</h2>
        <p className="sf-event-live-map-lede">
          Same-team positions only. Join to share your location until you Leave.
        </p>
      </header>
      <LiveMapPanel
        roomId={room.id}
        roomTitle={room.title}
        clientConfig={provider.clientConfig()}
        overlays={overlays.map((o) => ({
          id: o.id,
          kind: o.kind,
          pointKind: o.pointKind,
          label: o.label,
          latitude: o.latitude,
          longitude: o.longitude,
          mediaId: o.mediaId,
        }))}
        canJoin={Boolean(membership)}
        membershipTeamId={membership?.team.id}
        membershipTeamName={membership?.team.name}
        membershipTeamColor={membership?.team.color}
        initialPositions={initialPositions}
        center={
          point && point.latitude != null && point.longitude != null
            ? { lat: point.latitude, lng: point.longitude }
            : undefined
        }
      />
    </section>
  )
}
