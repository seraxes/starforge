/**
 * Channel naming + subscribe ACL helpers.
 *
 * v1 SSE only allows `user:{sessionUserId}`. Chat/Maps extend `canSubscribe`
 * later without changing the RealtimePort interface.
 */

export const USER_CHANNEL_PREFIX = 'user:' as const

export function userChannel(userId: string): string {
  return `${USER_CHANNEL_PREFIX}${userId}`
}

/** Split `?channels=` query into trimmed non-empty names. */
export function parseRealtimeChannels(raw: string | null | undefined): string[] {
  if (!raw) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of raw.split(',')) {
    const channel = part.trim()
    if (!channel || seen.has(channel)) continue
    seen.add(channel)
    out.push(channel)
  }
  return out
}

/**
 * Whether an authenticated user may open an SSE subscription on `channel`.
 * Extend here when Chat (`chat:…`) / Maps (`map:…`) ship room ACL.
 */
export function canSubscribe(userId: string, channel: string): boolean {
  if (!userId || !channel) return false
  return channel === userChannel(userId)
}

/** Filter requested channels to those the user may subscribe to. */
export function filterSubscribableChannels(
  userId: string,
  channels: readonly string[],
): { allowed: string[]; rejected: string[] } {
  const allowed: string[] = []
  const rejected: string[] = []
  for (const channel of channels) {
    if (canSubscribe(userId, channel)) allowed.push(channel)
    else rejected.push(channel)
  }
  return { allowed, rejected }
}
