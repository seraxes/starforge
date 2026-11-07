import type { LayoutSlotConfig } from '@/core/modules/types'

export type EventCountdownParticleConfig = {
  eventKey: string
  showTitle: boolean
}

export function defaultEventCountdownConfig(): EventCountdownParticleConfig {
  return { eventKey: '', showTitle: true }
}

export function readEventCountdownConfig(
  config: LayoutSlotConfig | undefined,
): EventCountdownParticleConfig {
  const c = config ?? {}
  const defaults = defaultEventCountdownConfig()
  const eventKey =
    typeof c.eventKey === 'string'
      ? c.eventKey.trim()
      : typeof c.eventId === 'string'
        ? c.eventId.trim()
        : typeof c.slug === 'string'
          ? c.slug.trim()
          : defaults.eventKey
  return {
    eventKey,
    showTitle: c.showTitle !== false && c.showTitle !== 'false',
  }
}
