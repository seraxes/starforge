/**
 * Channel naming + subscribe ACL helpers.
 *
 * Sync ACL: `user:{sessionUserId}`.
 * Async ACL: optional extra checkers (Maps `map:…`, later Chat).
 */

export const USER_CHANNEL_PREFIX = 'user:' as const
export const MAP_CHANNEL_PREFIX = 'map:' as const

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
 * Whether an authenticated user may open an SSE subscription on `channel` (sync).
 * User personal channel only — Maps/Chat use `filterSubscribableChannelsAsync`.
 */
export function canSubscribe(userId: string, channel: string): boolean {
  if (!userId || !channel) return false
  return channel === userChannel(userId)
}

export type RealtimeChannelAclChecker = (
  userId: string,
  channel: string,
) => boolean | Promise<boolean>

/** Filter requested channels to those the user may subscribe to (sync only). */
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

/**
 * Async filter — runs sync user ACL then optional extra checkers (Maps, Chat).
 */
export async function filterSubscribableChannelsAsync(
  userId: string,
  channels: readonly string[],
  extraCheckers: readonly RealtimeChannelAclChecker[] = [],
): Promise<{ allowed: string[]; rejected: string[] }> {
  const allowed: string[] = []
  const rejected: string[] = []
  for (const channel of channels) {
    if (canSubscribe(userId, channel)) {
      allowed.push(channel)
      continue
    }
    let ok = false
    for (const checker of extraCheckers) {
      try {
        if (await checker(userId, channel)) {
          ok = true
          break
        }
      } catch {
        // Fail closed on checker errors.
      }
    }
    if (ok) allowed.push(channel)
    else rejected.push(channel)
  }
  return { allowed, rejected }
}
