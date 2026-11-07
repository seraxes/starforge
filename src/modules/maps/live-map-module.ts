import React from 'react'

import { getMapProvider } from '@/core/maps'
import type { StarforgeModule } from '@/core/modules/types'
import { getAppSession } from '@/core/auth/session'
import { MODULE_IDS, isCatalogModuleEnabled } from '@/core/settings'

import { readLiveMapConfig } from './live-map-config'
import { LiveMapPanel } from './public/LiveMapPanel'
import {
  findMapRoomById,
  findMembershipForUserInRoom,
  listOverlaysForRoom,
  listTeamPositions,
  MAP_POSITION_STALE_MS,
  isPositionStale,
} from './store'

/**
 * live-map particle — closed tactical session for a configured room.
 */
export const liveMapModule: StarforgeModule = {
  id: 'live-map',
  name: 'Live map',
  description: 'Closed event tactical map (same-team GPS).',
  defaultWidth: 100,
  navViews: [{ key: 'admin', label: 'Live maps', href: '/admin/maps' }],
  render: async ({ slot, settings }) => {
    if (!isCatalogModuleEnabled(settings, MODULE_IDS.maps)) {
      return null
    }

    const cfg = readLiveMapConfig(slot.config)
    if (!cfg.roomId) {
      return React.createElement(
        'p',
        { className: 'settings-hint' },
        'Configure a live map room id on this particle (Admin → Live maps).',
      )
    }

    const room = await findMapRoomById(cfg.roomId)
    if (!room || !room.active) {
      return React.createElement(
        'p',
        { className: 'settings-hint' },
        'Live map room is missing or inactive.',
      )
    }

    const session = await getAppSession()
    const userId = session?.user?.id || ''
    const membership = userId
      ? await findMembershipForUserInRoom(room.id, userId)
      : null
    const overlays = await listOverlaysForRoom(room.id)
    const provider = await getMapProvider()
    const clientConfig = provider.clientConfig()

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

    return React.createElement(
      'div',
      { className: 'sf-live-map-particle' },
      cfg.heading.trim()
        ? React.createElement(
            'h2',
            { className: 'sf-live-map-heading' },
            cfg.heading.trim(),
          )
        : null,
      React.createElement(LiveMapPanel, {
        roomId: room.id,
        roomTitle: room.title,
        clientConfig,
        overlays: overlays.map((o) => ({
          id: o.id,
          kind: o.kind,
          pointKind: o.pointKind,
          label: o.label,
          latitude: o.latitude,
          longitude: o.longitude,
          mediaId: o.mediaId,
        })),
        height: cfg.height,
        canJoin: Boolean(membership),
        membershipTeamId: membership?.team.id,
        membershipTeamName: membership?.team.name,
        membershipTeamColor: membership?.team.color,
        initialPositions,
        center:
          point && point.latitude != null && point.longitude != null
            ? { lat: point.latitude, lng: point.longitude }
            : undefined,
      }),
    )
  },
}
