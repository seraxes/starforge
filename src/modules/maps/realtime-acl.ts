/**
 * Maps channel subscribe ACL — used by /api/realtime for map: channels.
 */

import 'server-only'

import { parseMapTeamChannel } from './channels'
import {
  findMapRoomById,
  findMembershipForUserInRoom,
  findTeamById,
  userIsRoomManager,
} from './store'

/** True when user may subscribe to a map:room:…:team:… channel. */
export async function canSubscribeMapChannel(
  userId: string,
  channel: string,
): Promise<boolean> {
  const parsed = parseMapTeamChannel(channel)
  if (!parsed) return false
  const room = await findMapRoomById(parsed.roomId)
  if (!room || !room.active) return false

  const team = await findTeamById(parsed.teamId)
  if (!team || team.roomId !== room.id) return false

  if (await userIsRoomManager(room, userId)) return true

  const membership = await findMembershipForUserInRoom(room.id, userId)
  return membership?.team.id === parsed.teamId
}
