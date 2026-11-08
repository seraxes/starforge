'use server'

import { revalidatePath } from 'next/cache'

import { requireAdminArea } from '@/core/acl/access'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { seedRoomFromEventFactions } from './seed-from-event'
import {
  createMapRoom,
  createOverlay,
  createTeam,
  deleteMapRoom,
  deleteOverlay,
  deleteTeam,
  findMapRoomByEventId,
  findMapRoomById,
  findTeamById,
  listTeamMemberUserIds,
  setRoomAdmins,
  setTeamMembers,
  updateMapRoom,
  updateOverlay,
  updateTeam,
  userIsRoomManager,
} from './store'
import { isMapPointKind } from './types'

async function requireMapsAdmin() {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.maps)) {
    throw new Error('TacMap (product:maps) is disabled')
  }
  const session = await requireAdminArea('admin.maps')
  if (!session?.user?.id) throw new Error('Unauthorized')
  return session
}

function revalidateMapsAdmin(roomId?: string) {
  revalidatePath('/admin/maps')
  if (roomId) revalidatePath(`/admin/maps/${roomId}`)
}

export async function createMapRoomAction(input: {
  eventId: string
  title?: string
  seedFromFactions?: boolean
}): Promise<{ ok: true; roomId: string } | { ok: false; error: string }> {
  try {
    const session = await requireMapsAdmin()
    const existing = await findMapRoomByEventId(input.eventId)
    if (existing) {
      return { ok: false, error: 'A TacMap room already exists for this event.' }
    }
    const room = await createMapRoom({
      eventId: input.eventId,
      title: input.title,
      ownerUserId: session.user.id,
    })
    if (input.seedFromFactions) {
      await seedRoomFromEventFactions(room.id, room.eventId)
    }
    revalidateMapsAdmin(room.id)
    return { ok: true, roomId: room.id }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Create failed' }
  }
}

export async function updateMapRoomAction(input: {
  roomId: string
  title?: string
  active?: boolean
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireMapsAdmin()
    const room = await updateMapRoom(input.roomId, {
      title: input.title,
      active: input.active,
    })
    if (!room) return { ok: false, error: 'Room not found' }
    revalidateMapsAdmin(room.id)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Update failed' }
  }
}

export async function deleteMapRoomAction(
  roomId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireMapsAdmin()
    await deleteMapRoom(roomId)
    revalidateMapsAdmin()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Delete failed' }
  }
}

export async function setRoomAdminsAction(input: {
  roomId: string
  userIds: string[]
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await requireMapsAdmin()
    const room = await findMapRoomById(input.roomId)
    if (!room) return { ok: false, error: 'Room not found' }
    if (!(await userIsRoomManager(room, session.user.id))) {
      // Site maps admin may still set admins.
    }
    await setRoomAdmins(
      input.roomId,
      input.userIds.filter((id) => id !== room.ownerUserId),
    )
    revalidateMapsAdmin(input.roomId)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Save failed' }
  }
}

export async function createTeamAction(input: {
  roomId: string
  name: string
  color?: string
}): Promise<{ ok: true; teamId: string } | { ok: false; error: string }> {
  try {
    await requireMapsAdmin()
    const team = await createTeam(input)
    revalidateMapsAdmin(input.roomId)
    return { ok: true, teamId: team.id }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Create failed' }
  }
}

export async function updateTeamAction(input: {
  teamId: string
  name?: string
  color?: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireMapsAdmin()
    const team = await updateTeam(input.teamId, {
      name: input.name,
      color: input.color,
    })
    if (!team) return { ok: false, error: 'Team not found' }
    revalidateMapsAdmin(team.roomId)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Update failed' }
  }
}

export async function deleteTeamAction(
  teamId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireMapsAdmin()
    const team = await findTeamById(teamId)
    if (!team) return { ok: false, error: 'Team not found' }
    await deleteTeam(teamId)
    revalidateMapsAdmin(team.roomId)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Delete failed' }
  }
}

export async function setTeamMembersAction(input: {
  teamId: string
  userIds: string[]
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireMapsAdmin()
    const team = await findTeamById(input.teamId)
    if (!team) return { ok: false, error: 'Team not found' }
    await setTeamMembers(input.teamId, input.userIds)
    revalidateMapsAdmin(team.roomId)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Save failed' }
  }
}

export async function seedRoomFromFactionsAction(
  roomId: string,
): Promise<
  | { ok: true; teamsCreated: number; membersAdded: number }
  | { ok: false; error: string }
> {
  try {
    await requireMapsAdmin()
    const room = await findMapRoomById(roomId)
    if (!room) return { ok: false, error: 'Room not found' }
    const result = await seedRoomFromEventFactions(room.id, room.eventId)
    revalidateMapsAdmin(room.id)
    return { ok: true, ...result }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Seed failed' }
  }
}

export async function createPointOverlayAction(input: {
  roomId: string
  label: string
  latitude: number
  longitude: number
  pointKind?: string
}): Promise<{ ok: true; overlayId: string } | { ok: false; error: string }> {
  try {
    await requireMapsAdmin()
    if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) {
      return { ok: false, error: 'Invalid coordinates' }
    }
    const overlay = await createOverlay({
      roomId: input.roomId,
      kind: 'point',
      pointKind: isMapPointKind(input.pointKind) ? input.pointKind : 'poi',
      label: input.label,
      latitude: input.latitude,
      longitude: input.longitude,
    })
    revalidateMapsAdmin(input.roomId)
    return { ok: true, overlayId: overlay.id }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Create failed' }
  }
}

export async function createKmlOverlayAction(input: {
  roomId: string
  label: string
  mediaId: string
}): Promise<{ ok: true; overlayId: string } | { ok: false; error: string }> {
  try {
    await requireMapsAdmin()
    const mediaId = input.mediaId.trim()
    if (!mediaId) return { ok: false, error: 'Media required' }
    const overlay = await createOverlay({
      roomId: input.roomId,
      kind: 'kml',
      label: input.label || 'KML overlay',
      mediaId,
    })
    revalidateMapsAdmin(input.roomId)
    return { ok: true, overlayId: overlay.id }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Create failed' }
  }
}

export async function updateOverlayAction(input: {
  overlayId: string
  roomId: string
  label?: string
  latitude?: number | null
  longitude?: number | null
  pointKind?: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireMapsAdmin()
    const overlay = await updateOverlay(input.overlayId, {
      label: input.label,
      latitude: input.latitude,
      longitude: input.longitude,
      pointKind: isMapPointKind(input.pointKind) ? input.pointKind : undefined,
    })
    if (!overlay) return { ok: false, error: 'Overlay not found' }
    revalidateMapsAdmin(input.roomId)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Update failed' }
  }
}

export async function deleteOverlayAction(input: {
  overlayId: string
  roomId: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireMapsAdmin()
    await deleteOverlay(input.overlayId)
    revalidateMapsAdmin(input.roomId)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Delete failed' }
  }
}

/** Used by edit page to reload member ids after client save. */
export async function getTeamMemberIdsAction(
  teamId: string,
): Promise<string[]> {
  await requireMapsAdmin()
  return listTeamMemberUserIds(teamId)
}
