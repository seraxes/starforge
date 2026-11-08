/**
 * Live tactical map persistence (product:maps).
 */

import 'server-only'

import { and, asc, eq, inArray, isNull } from 'drizzle-orm'

import { db } from '@/core/db'

import {
  sfMapOverlays,
  sfMapPositions,
  sfMapRoomAdmins,
  sfMapRooms,
  sfMapSessions,
  sfMapTeamMembers,
  sfMapTeams,
} from './schema'
import type {
  MapOverlayKind,
  MapOverlayRecord,
  MapPointKind,
  MapPositionRecord,
  MapRoomRecord,
  MapSessionRecord,
  MapTeamMemberRecord,
  MapTeamRecord,
} from './types'
import { isMapOverlayKind, isMapPointKind } from './types'

const STALE_MS = 90_000

function isMissingMapTable(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  return /sf_map_|does not exist|relation/i.test(msg)
}

function mapRoom(row: typeof sfMapRooms.$inferSelect): MapRoomRecord {
  return {
    id: row.id,
    eventId: row.eventId,
    title: row.title?.trim() || 'TacMap',
    ownerUserId: row.ownerUserId,
    active: Boolean(row.active),
    startsAt: row.startsAt ?? null,
    endsAt: row.endsAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapTeam(row: typeof sfMapTeams.$inferSelect): MapTeamRecord {
  return {
    id: row.id,
    roomId: row.roomId,
    name: row.name?.trim() || 'Team',
    color: (row.color || '#3b82f6').trim() || '#3b82f6',
    sortOrder: typeof row.sortOrder === 'number' ? row.sortOrder : 0,
    ticketTierId: (row.ticketTierId || '').trim(),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapOverlay(row: typeof sfMapOverlays.$inferSelect): MapOverlayRecord {
  return {
    id: row.id,
    roomId: row.roomId,
    kind: isMapOverlayKind(row.kind) ? row.kind : 'point',
    pointKind: isMapPointKind(row.pointKind) ? row.pointKind : 'poi',
    label: row.label ?? '',
    latitude:
      typeof row.latitude === 'number' && Number.isFinite(row.latitude)
        ? row.latitude
        : null,
    longitude:
      typeof row.longitude === 'number' && Number.isFinite(row.longitude)
        ? row.longitude
        : null,
    mediaId: (row.mediaId || '').trim(),
    geojson: row.geojson ?? null,
    sortOrder: typeof row.sortOrder === 'number' ? row.sortOrder : 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapSession(row: typeof sfMapSessions.$inferSelect): MapSessionRecord {
  return {
    id: row.id,
    roomId: row.roomId,
    teamId: row.teamId,
    userId: row.userId,
    consentAt: row.consentAt,
    joinedAt: row.joinedAt,
    leftAt: row.leftAt ?? null,
  }
}

function mapPosition(row: typeof sfMapPositions.$inferSelect): MapPositionRecord {
  return {
    sessionId: row.sessionId,
    roomId: row.roomId,
    teamId: row.teamId,
    userId: row.userId,
    latitude: row.latitude,
    longitude: row.longitude,
    accuracy:
      typeof row.accuracy === 'number' && Number.isFinite(row.accuracy)
        ? row.accuracy
        : null,
    heading:
      typeof row.heading === 'number' && Number.isFinite(row.heading)
        ? row.heading
        : null,
    updatedAt: row.updatedAt,
  }
}

export async function listMapRooms(): Promise<MapRoomRecord[]> {
  try {
    const rows = await db.select().from(sfMapRooms).orderBy(asc(sfMapRooms.createdAt))
    return rows.map(mapRoom)
  } catch (error) {
    if (isMissingMapTable(error)) return []
    throw error
  }
}

export async function findMapRoomById(id: string): Promise<MapRoomRecord | null> {
  const trimmed = id.trim()
  if (!trimmed) return null
  try {
    const rows = await db
      .select()
      .from(sfMapRooms)
      .where(eq(sfMapRooms.id, trimmed))
      .limit(1)
    return rows[0] ? mapRoom(rows[0]) : null
  } catch (error) {
    if (isMissingMapTable(error)) return null
    throw error
  }
}

export async function findMapRoomByEventId(
  eventId: string,
): Promise<MapRoomRecord | null> {
  const trimmed = eventId.trim()
  if (!trimmed) return null
  try {
    const rows = await db
      .select()
      .from(sfMapRooms)
      .where(eq(sfMapRooms.eventId, trimmed))
      .limit(1)
    return rows[0] ? mapRoom(rows[0]) : null
  } catch (error) {
    // Migration 0012 not applied yet — treat as no live map room.
    if (isMissingMapTable(error)) return null
    throw error
  }
}

export async function createMapRoom(input: {
  eventId: string
  title?: string
  ownerUserId: string
  active?: boolean
}): Promise<MapRoomRecord> {
  const id = crypto.randomUUID()
  const eventId = input.eventId.trim()
  if (!eventId) throw new Error('eventId required')
  const ownerUserId = input.ownerUserId.trim()
  if (!ownerUserId) throw new Error('ownerUserId required')

  await db.insert(sfMapRooms).values({
    id,
    eventId,
    title: (input.title || 'TacMap').trim() || 'TacMap',
    ownerUserId,
    active: input.active !== false,
  })
  const created = await findMapRoomById(id)
  if (!created) throw new Error('Failed to create map room')
  return created
}

export async function updateMapRoom(
  id: string,
  patch: Partial<{
    title: string
    active: boolean
    startsAt: Date | null
    endsAt: Date | null
    ownerUserId: string
  }>,
): Promise<MapRoomRecord | null> {
  const room = await findMapRoomById(id)
  if (!room) return null
  await db
    .update(sfMapRooms)
    .set({
      ...(patch.title != null ? { title: patch.title.trim() || 'TacMap' } : {}),
      ...(patch.active != null ? { active: patch.active } : {}),
      ...(patch.startsAt !== undefined ? { startsAt: patch.startsAt } : {}),
      ...(patch.endsAt !== undefined ? { endsAt: patch.endsAt } : {}),
      ...(patch.ownerUserId != null
        ? { ownerUserId: patch.ownerUserId.trim() }
        : {}),
    })
    .where(eq(sfMapRooms.id, room.id))
  return findMapRoomById(room.id)
}

export async function deleteMapRoom(id: string): Promise<boolean> {
  const room = await findMapRoomById(id)
  if (!room) return false
  await db.delete(sfMapRooms).where(eq(sfMapRooms.id, room.id))
  return true
}

export async function listRoomAdminUserIds(roomId: string): Promise<string[]> {
  const rows = await db
    .select()
    .from(sfMapRoomAdmins)
    .where(eq(sfMapRoomAdmins.roomId, roomId.trim()))
  return rows.map((r) => r.userId)
}

export async function setRoomAdmins(
  roomId: string,
  userIds: string[],
): Promise<void> {
  const rid = roomId.trim()
  await db.delete(sfMapRoomAdmins).where(eq(sfMapRoomAdmins.roomId, rid))
  const unique = [...new Set(userIds.map((id) => id.trim()).filter(Boolean))]
  if (!unique.length) return
  await db.insert(sfMapRoomAdmins).values(
    unique.map((userId) => ({
      id: crypto.randomUUID(),
      roomId: rid,
      userId,
    })),
  )
}

export async function userIsRoomManager(
  room: MapRoomRecord,
  userId: string,
): Promise<boolean> {
  const uid = userId.trim()
  if (!uid) return false
  if (room.ownerUserId === uid) return true
  const admins = await listRoomAdminUserIds(room.id)
  return admins.includes(uid)
}

export async function listTeamsForRoom(roomId: string): Promise<MapTeamRecord[]> {
  const rows = await db
    .select()
    .from(sfMapTeams)
    .where(eq(sfMapTeams.roomId, roomId.trim()))
    .orderBy(asc(sfMapTeams.sortOrder), asc(sfMapTeams.name))
  return rows.map(mapTeam)
}

export async function findTeamById(id: string): Promise<MapTeamRecord | null> {
  const rows = await db
    .select()
    .from(sfMapTeams)
    .where(eq(sfMapTeams.id, id.trim()))
    .limit(1)
  return rows[0] ? mapTeam(rows[0]) : null
}

export async function createTeam(input: {
  roomId: string
  name: string
  color?: string
  sortOrder?: number
  ticketTierId?: string
}): Promise<MapTeamRecord> {
  const id = crypto.randomUUID()
  await db.insert(sfMapTeams).values({
    id,
    roomId: input.roomId.trim(),
    name: (input.name || 'Team').trim() || 'Team',
    color: (input.color || '#3b82f6').trim() || '#3b82f6',
    sortOrder: input.sortOrder ?? 0,
    ticketTierId: (input.ticketTierId || '').trim() || null,
  })
  const team = await findTeamById(id)
  if (!team) throw new Error('Failed to create team')
  return team
}

export async function updateTeam(
  id: string,
  patch: Partial<{ name: string; color: string; sortOrder: number }>,
): Promise<MapTeamRecord | null> {
  const team = await findTeamById(id)
  if (!team) return null
  await db
    .update(sfMapTeams)
    .set({
      ...(patch.name != null ? { name: patch.name.trim() || 'Team' } : {}),
      ...(patch.color != null
        ? { color: patch.color.trim() || '#3b82f6' }
        : {}),
      ...(patch.sortOrder != null ? { sortOrder: patch.sortOrder } : {}),
    })
    .where(eq(sfMapTeams.id, team.id))
  return findTeamById(team.id)
}

export async function deleteTeam(id: string): Promise<boolean> {
  const team = await findTeamById(id)
  if (!team) return false
  await db.delete(sfMapTeams).where(eq(sfMapTeams.id, team.id))
  return true
}

export async function listTeamMembers(
  teamId: string,
): Promise<MapTeamMemberRecord[]> {
  const rows = await db
    .select()
    .from(sfMapTeamMembers)
    .where(eq(sfMapTeamMembers.teamId, teamId.trim()))
  return rows.map((row) => ({
    id: row.id,
    teamId: row.teamId,
    userId: row.userId,
    createdAt: row.createdAt,
  }))
}

export async function listTeamMemberUserIds(teamId: string): Promise<string[]> {
  const members = await listTeamMembers(teamId)
  return members.map((m) => m.userId)
}

export async function setTeamMembers(
  teamId: string,
  userIds: string[],
): Promise<void> {
  const tid = teamId.trim()
  await db.delete(sfMapTeamMembers).where(eq(sfMapTeamMembers.teamId, tid))
  const unique = [...new Set(userIds.map((id) => id.trim()).filter(Boolean))]
  if (!unique.length) return
  await db.insert(sfMapTeamMembers).values(
    unique.map((userId) => ({
      id: crypto.randomUUID(),
      teamId: tid,
      userId,
    })),
  )
}

export async function findMembershipForUserInRoom(
  roomId: string,
  userId: string,
): Promise<{ team: MapTeamRecord; member: MapTeamMemberRecord } | null> {
  const teams = await listTeamsForRoom(roomId)
  if (!teams.length) return null
  const teamIds = teams.map((t) => t.id)
  const rows = await db
    .select()
    .from(sfMapTeamMembers)
    .where(
      and(
        inArray(sfMapTeamMembers.teamId, teamIds),
        eq(sfMapTeamMembers.userId, userId.trim()),
      ),
    )
    .limit(1)
  const row = rows[0]
  if (!row) return null
  const team = teams.find((t) => t.id === row.teamId)
  if (!team) return null
  return {
    team,
    member: {
      id: row.id,
      teamId: row.teamId,
      userId: row.userId,
      createdAt: row.createdAt,
    },
  }
}

export async function listOverlaysForRoom(
  roomId: string,
): Promise<MapOverlayRecord[]> {
  const rows = await db
    .select()
    .from(sfMapOverlays)
    .where(eq(sfMapOverlays.roomId, roomId.trim()))
    .orderBy(asc(sfMapOverlays.sortOrder))
  return rows.map(mapOverlay)
}

export async function createOverlay(input: {
  roomId: string
  kind?: MapOverlayKind
  pointKind?: MapPointKind
  label?: string
  latitude?: number | null
  longitude?: number | null
  mediaId?: string
  geojson?: unknown
  sortOrder?: number
}): Promise<MapOverlayRecord> {
  const id = crypto.randomUUID()
  await db.insert(sfMapOverlays).values({
    id,
    roomId: input.roomId.trim(),
    kind: input.kind ?? 'point',
    pointKind: input.pointKind ?? 'poi',
    label: (input.label || '').trim(),
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    mediaId: (input.mediaId || '').trim() || null,
    geojson: input.geojson ?? null,
    sortOrder: input.sortOrder ?? 0,
  })
  const rows = await db
    .select()
    .from(sfMapOverlays)
    .where(eq(sfMapOverlays.id, id))
    .limit(1)
  if (!rows[0]) throw new Error('Failed to create overlay')
  return mapOverlay(rows[0])
}

export async function updateOverlay(
  id: string,
  patch: Partial<{
    label: string
    latitude: number | null
    longitude: number | null
    pointKind: MapPointKind
    mediaId: string
    geojson: unknown | null
    sortOrder: number
  }>,
): Promise<MapOverlayRecord | null> {
  const rows = await db
    .select()
    .from(sfMapOverlays)
    .where(eq(sfMapOverlays.id, id.trim()))
    .limit(1)
  if (!rows[0]) return null
  await db
    .update(sfMapOverlays)
    .set({
      ...(patch.label != null ? { label: patch.label.trim() } : {}),
      ...(patch.latitude !== undefined ? { latitude: patch.latitude } : {}),
      ...(patch.longitude !== undefined ? { longitude: patch.longitude } : {}),
      ...(patch.pointKind != null ? { pointKind: patch.pointKind } : {}),
      ...(patch.mediaId != null
        ? { mediaId: patch.mediaId.trim() || null }
        : {}),
      ...(patch.geojson !== undefined ? { geojson: patch.geojson } : {}),
      ...(patch.sortOrder != null ? { sortOrder: patch.sortOrder } : {}),
    })
    .where(eq(sfMapOverlays.id, id.trim()))
  const next = await db
    .select()
    .from(sfMapOverlays)
    .where(eq(sfMapOverlays.id, id.trim()))
    .limit(1)
  return next[0] ? mapOverlay(next[0]) : null
}

export async function deleteOverlay(id: string): Promise<boolean> {
  const result = await db
    .delete(sfMapOverlays)
    .where(eq(sfMapOverlays.id, id.trim()))
    .returning({ id: sfMapOverlays.id })
  return result.length > 0
}

export async function findActiveSession(
  roomId: string,
  userId: string,
): Promise<MapSessionRecord | null> {
  const rows = await db
    .select()
    .from(sfMapSessions)
    .where(
      and(
        eq(sfMapSessions.roomId, roomId.trim()),
        eq(sfMapSessions.userId, userId.trim()),
        isNull(sfMapSessions.leftAt),
      ),
    )
    .limit(1)
  return rows[0] ? mapSession(rows[0]) : null
}

export async function joinMapSession(input: {
  roomId: string
  teamId: string
  userId: string
}): Promise<MapSessionRecord> {
  const existing = await findActiveSession(input.roomId, input.userId)
  if (existing) {
    if (existing.teamId === input.teamId) return existing
    await leaveMapSession(existing.id)
  }
  const id = crypto.randomUUID()
  const now = new Date()
  await db.insert(sfMapSessions).values({
    id,
    roomId: input.roomId.trim(),
    teamId: input.teamId.trim(),
    userId: input.userId.trim(),
    consentAt: now,
    joinedAt: now,
    leftAt: null,
  })
  const rows = await db
    .select()
    .from(sfMapSessions)
    .where(eq(sfMapSessions.id, id))
    .limit(1)
  if (!rows[0]) throw new Error('Failed to join session')
  return mapSession(rows[0])
}

export async function leaveMapSession(sessionId: string): Promise<void> {
  const sid = sessionId.trim()
  await db
    .update(sfMapSessions)
    .set({ leftAt: new Date() })
    .where(and(eq(sfMapSessions.id, sid), isNull(sfMapSessions.leftAt)))
  await db.delete(sfMapPositions).where(eq(sfMapPositions.sessionId, sid))
}

export async function leaveActiveSessionForUser(
  roomId: string,
  userId: string,
): Promise<boolean> {
  const session = await findActiveSession(roomId, userId)
  if (!session) return false
  await leaveMapSession(session.id)
  return true
}

export async function upsertPosition(input: {
  session: MapSessionRecord
  latitude: number
  longitude: number
  accuracy?: number | null
  heading?: number | null
}): Promise<MapPositionRecord> {
  const now = new Date()
  await db
    .insert(sfMapPositions)
    .values({
      sessionId: input.session.id,
      roomId: input.session.roomId,
      teamId: input.session.teamId,
      userId: input.session.userId,
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy: input.accuracy ?? null,
      heading: input.heading ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: sfMapPositions.sessionId,
      set: {
        latitude: input.latitude,
        longitude: input.longitude,
        accuracy: input.accuracy ?? null,
        heading: input.heading ?? null,
        updatedAt: now,
        teamId: input.session.teamId,
        roomId: input.session.roomId,
        userId: input.session.userId,
      },
    })
  const rows = await db
    .select()
    .from(sfMapPositions)
    .where(eq(sfMapPositions.sessionId, input.session.id))
    .limit(1)
  if (!rows[0]) throw new Error('Failed to upsert position')
  return mapPosition(rows[0])
}

export async function listTeamPositions(
  teamId: string,
): Promise<MapPositionRecord[]> {
  const rows = await db
    .select()
    .from(sfMapPositions)
    .where(eq(sfMapPositions.teamId, teamId.trim()))
  return rows.map(mapPosition)
}

export function isPositionStale(
  updatedAt: Date,
  now = Date.now(),
  staleMs = STALE_MS,
): boolean {
  return now - updatedAt.getTime() > staleMs
}

export { STALE_MS as MAP_POSITION_STALE_MS }
