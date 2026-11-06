import type { LayoutSlotConfig } from '@/core/modules/types'

export type EventDetailParticleConfig = {
  /** Published event id or slug to show. */
  eventKey: string
  showBackLink: boolean
}

export function defaultEventDetailConfig(): EventDetailParticleConfig {
  return {
    eventKey: '',
    showBackLink: true,
  }
}

export function readEventDetailConfig(
  config: LayoutSlotConfig | undefined,
): EventDetailParticleConfig {
  const c = config ?? {}
  const defaults = defaultEventDetailConfig()
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
    showBackLink: c.showBackLink !== false && c.showBackLink !== 'false',
  }
}
