import type { LayoutSlotConfig } from '@/core/modules/types'

export type SocialPagesParticleConfig = {
  heading: string
  emptyMessage: string
  limit: number
}

export function defaultSocialPagesConfig(): SocialPagesParticleConfig {
  return {
    heading: 'Pages',
    emptyMessage: 'No liked pages yet.',
    limit: 12,
  }
}

export function readSocialPagesConfig(
  config: LayoutSlotConfig | undefined,
): SocialPagesParticleConfig {
  const c = config ?? {}
  const defaults = defaultSocialPagesConfig()
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
