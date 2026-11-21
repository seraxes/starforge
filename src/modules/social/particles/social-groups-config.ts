import type { LayoutSlotConfig } from '@/core/modules/types'

export type SocialGroupsParticleConfig = {
  heading: string
  emptyMessage: string
  limit: number
}

export function defaultSocialGroupsConfig(): SocialGroupsParticleConfig {
  return {
    heading: 'Groups',
    emptyMessage: 'No groups yet.',
    limit: 12,
  }
}

export function readSocialGroupsConfig(
  config: LayoutSlotConfig | undefined,
): SocialGroupsParticleConfig {
  const c = config ?? {}
  const defaults = defaultSocialGroupsConfig()
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
