import type { LayoutSlotConfig } from '@/core/modules/types'

export type EventListParticleConfig = {
  heading: string
  emptyMessage: string
  limit: number
  includePast: boolean
}

export function defaultEventListConfig(): EventListParticleConfig {
  return {
    heading: 'Upcoming events',
    emptyMessage: 'No upcoming events.',
    limit: 10,
    includePast: false,
  }
}

export function readEventListConfig(
  config: LayoutSlotConfig | undefined,
): EventListParticleConfig {
  const c = config ?? {}
  const defaults = defaultEventListConfig()
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
    includePast: c.includePast === true || c.includePast === 'true',
  }
}
