import type { LayoutSlotConfig } from '@/core/modules/types'

export type EventFeaturedParticleConfig = {
  heading: string
  limit: number
  /** Auto-rotate ms; 0 disables. */
  intervalMs: number
  includePast: boolean
}

export function defaultEventFeaturedConfig(): EventFeaturedParticleConfig {
  return {
    heading: 'Featured',
    limit: 8,
    intervalMs: 6000,
    includePast: false,
  }
}

export function readEventFeaturedConfig(
  config: LayoutSlotConfig | undefined,
): EventFeaturedParticleConfig {
  const c = config ?? {}
  const defaults = defaultEventFeaturedConfig()
  const limitRaw = typeof c.limit === 'number' ? c.limit : Number(c.limit)
  const intervalRaw =
    typeof c.intervalMs === 'number' ? c.intervalMs : Number(c.intervalMs)
  return {
    heading: typeof c.heading === 'string' ? c.heading : defaults.heading,
    limit:
      Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(Math.floor(limitRaw), 24)
        : defaults.limit,
    intervalMs:
      Number.isFinite(intervalRaw) && intervalRaw >= 0
        ? Math.min(Math.floor(intervalRaw), 120_000)
        : defaults.intervalMs,
    includePast: c.includePast === true || c.includePast === 'true',
  }
}
