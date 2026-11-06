import type { LayoutSlotConfig } from '@/core/modules/types'

export type MapParticleConfig = {
  heading: string
  /** When true, pin all published-event venues that have coordinates. */
  showEventVenues: boolean
  /** Optional fixed center (used when no markers). */
  centerLat: number | null
  centerLng: number | null
  zoom: number
  height: string
}

export function defaultMapConfig(): MapParticleConfig {
  return {
    heading: 'Map',
    showEventVenues: true,
    centerLat: null,
    centerLng: null,
    zoom: 12,
    height: '18rem',
  }
}

function numOrNull(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim())
  return Number.isFinite(n) ? n : null
}

export function readMapConfig(config: LayoutSlotConfig | undefined): MapParticleConfig {
  const c = config ?? {}
  const defaults = defaultMapConfig()
  const zoomRaw = numOrNull(c.zoom)
  return {
    heading: typeof c.heading === 'string' ? c.heading : defaults.heading,
    showEventVenues: c.showEventVenues !== false && c.showEventVenues !== 'false',
    centerLat: numOrNull(c.centerLat) ?? defaults.centerLat,
    centerLng: numOrNull(c.centerLng) ?? defaults.centerLng,
    zoom:
      zoomRaw != null && zoomRaw >= 1 && zoomRaw <= 19
        ? Math.floor(zoomRaw)
        : defaults.zoom,
    height:
      typeof c.height === 'string' && c.height.trim()
        ? c.height.trim()
        : defaults.height,
  }
}
