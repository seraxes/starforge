import type { LayoutSlotConfig } from '@/core/modules/types'

export type SocialStoriesParticleConfig = {
  heading: string
  emptyMessage: string
  limit: number
}

export function defaultSocialStoriesConfig(): SocialStoriesParticleConfig {
  return {
    heading: 'Stories',
    emptyMessage: 'No active stories yet.',
    limit: 12,
  }
}

export function readSocialStoriesConfig(
  config: LayoutSlotConfig | undefined,
): SocialStoriesParticleConfig {
  const c = config ?? {}
  const defaults = defaultSocialStoriesConfig()
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
