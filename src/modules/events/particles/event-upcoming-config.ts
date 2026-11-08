import type { LayoutSlotConfig } from '@/core/modules/types'

export type EventUpcomingParticleConfig = {
  heading: string
  emptyMessage: string
  limit: number
  includePast: boolean
}

export function defaultEventUpcomingConfig(): EventUpcomingParticleConfig {
  return {
    heading: 'Upcoming events',
    emptyMessage: 'No upcoming events.',
    limit: 12,
    includePast: false,
  }
}

export function readEventUpcomingConfig(
  config: LayoutSlotConfig | undefined,
): EventUpcomingParticleConfig {
  const c = config ?? {}
  const defaults = defaultEventUpcomingConfig()
  const limitRaw = typeof c.limit === 'number' ? c.limit : Number(c.limit)
  return {
    heading: typeof c.heading === 'string' ? c.heading : defaults.heading,
    emptyMessage:
      typeof c.emptyMessage === 'string' && c.emptyMessage.trim()
        ? c.emptyMessage.trim()
        : defaults.emptyMessage,
    limit:
      Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(Math.floor(limitRaw), 100)
        : defaults.limit,
    includePast: c.includePast === true || c.includePast === 'true',
  }
}
