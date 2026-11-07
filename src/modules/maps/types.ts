/** Live tactical map domain types (product:maps). */

export type MapRoomRecord = {
  id: string
  eventId: string
  title: string
  ownerUserId: string
  active: boolean
  startsAt: Date | null
  endsAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type MapTeamRecord = {
  id: string
  roomId: string
  name: string
  color: string
  sortOrder: number
  ticketTierId: string
  createdAt: Date
  updatedAt: Date
}

export type MapTeamMemberRecord = {
  id: string
  teamId: string
  userId: string
  createdAt: Date
}

export type MapOverlayKind = 'point' | 'kml'
export type MapPointKind = 'base' | 'poi'

export type MapOverlayRecord = {
  id: string
  roomId: string
  kind: MapOverlayKind
  pointKind: MapPointKind
  label: string
  latitude: number | null
  longitude: number | null
  mediaId: string
  geojson: unknown | null
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

export type MapSessionRecord = {
  id: string
  roomId: string
  teamId: string
  userId: string
  consentAt: Date
  joinedAt: Date
  leftAt: Date | null
}

export type MapPositionRecord = {
  sessionId: string
  roomId: string
  teamId: string
  userId: string
  latitude: number
  longitude: number
  accuracy: number | null
  heading: number | null
  updatedAt: Date
}

export type LiveTeammatePosition = {
  userId: string
  latitude: number
  longitude: number
  accuracy: number | null
  heading: number | null
  updatedAt: string
  stale: boolean
}

export function isMapOverlayKind(value: unknown): value is MapOverlayKind {
  return value === 'point' || value === 'kml'
}

export function isMapPointKind(value: unknown): value is MapPointKind {
  return value === 'base' || value === 'poi'
}
