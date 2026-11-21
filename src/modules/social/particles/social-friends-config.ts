import type { LayoutSlotConfig } from '@/core/modules/types'

export type SocialFriendsParticleConfig = {
  heading: string
  emptyMessage: string
  limit: number
}

export function defaultSocialFriendsConfig(): SocialFriendsParticleConfig {
  return {
    heading: 'Friends',
    emptyMessage: 'No friends yet.',
    limit: 12,
  }
}

export function readSocialFriendsConfig(
  config: LayoutSlotConfig | undefined,
): SocialFriendsParticleConfig {
  const c = config ?? {}
  const defaults = defaultSocialFriendsConfig()
  const limitRaw = typeof c.limit === 'number' ? c.limit : Number(c.limit)
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(Math.floor(limitRaw), 100)
      : defaults.limit
  return {
    heading: typeof c.heading === 'string' ? c.heading : defaults.heading,
    emptyMessage:
      typeof c.emptyMessage === 'string' && c.emptyMessage.trim()
        ? c.emptyMessage.trim()
        : defaults.emptyMessage,
    limit,
  }
}
