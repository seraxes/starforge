import type { LayoutSlotConfig } from '@/core/modules/types'

export type EventCalendarParticleConfig = {
  heading: string
  limit: number
  showThumbnails: boolean
}

export function defaultEventCalendarConfig(): EventCalendarParticleConfig {
  return {
    heading: 'Calendar',
    limit: 100,
    showThumbnails: true,
  }
}

export function readEventCalendarConfig(
  config: LayoutSlotConfig | undefined,
): EventCalendarParticleConfig {
  const c = config ?? {}
  const defaults = defaultEventCalendarConfig()
  const limitRaw = typeof c.limit === 'number' ? c.limit : Number(c.limit)
  return {
    heading: typeof c.heading === 'string' ? c.heading : defaults.heading,
    limit:
      Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(Math.floor(limitRaw), 200)
        : defaults.limit,
    showThumbnails: c.showThumbnails !== false && c.showThumbnails !== 'false',
  }
}
