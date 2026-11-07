/**
 * Realtime channel helpers for live tactical maps.
 * Channel shape: map:room:{roomId}:team:{teamId}
 */

export const MAP_CHANNEL_PREFIX = 'map:room:' as const

export function mapTeamChannel(roomId: string, teamId: string): string {
  return `${MAP_CHANNEL_PREFIX}${roomId}:team:${teamId}`
}

export type ParsedMapChannel = {
  roomId: string
  teamId: string
}

/** Parse `map:room:{roomId}:team:{teamId}` or return null. */
export function parseMapTeamChannel(channel: string): ParsedMapChannel | null {
  const trimmed = channel.trim()
  if (!trimmed.startsWith(MAP_CHANNEL_PREFIX)) return null
  const rest = trimmed.slice(MAP_CHANNEL_PREFIX.length)
  const marker = ':team:'
  const idx = rest.indexOf(marker)
  if (idx <= 0) return null
  const roomId = rest.slice(0, idx).trim()
  const teamId = rest.slice(idx + marker.length).trim()
  if (!roomId || !teamId || roomId.includes(':')) return null
  return { roomId, teamId }
}

export function isMapTeamChannel(channel: string): boolean {
  return parseMapTeamChannel(channel) != null
}
