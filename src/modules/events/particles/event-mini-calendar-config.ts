import type { LayoutSlotConfig } from '@/core/modules/types'

export type EventMiniCalendarParticleConfig = {
  heading: string
  limit: number
  /** When set, show link to hub calendar view. */
  showCalendarLink: boolean
}

export function defaultEventMiniCalendarConfig(): EventMiniCalendarParticleConfig {
  return {
    heading: '',
    limit: 40,
    showCalendarLink: true,
  }
}

export function readEventMiniCalendarConfig(
  config: LayoutSlotConfig | undefined,
): EventMiniCalendarParticleConfig {
  const c = config ?? {}
  const defaults = defaultEventMiniCalendarConfig()
  const limitRaw = typeof c.limit === 'number' ? c.limit : Number(c.limit)
  return {
    heading: typeof c.heading === 'string' ? c.heading : defaults.heading,
    limit:
      Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(Math.floor(limitRaw), 100)
        : defaults.limit,
    showCalendarLink:
      c.showCalendarLink !== false && c.showCalendarLink !== 'false',
  }
}
