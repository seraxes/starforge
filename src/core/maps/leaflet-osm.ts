/**
 * leaflet-osm MapProvider — free OSM tiles + Nominatim geocode (no paid key).
 */

import 'server-only'

import type { GeoPoint, MapClientConfig, MapProvider } from './types'

const NOMINATIM = 'https://nominatim.openstreetmap.org'

function parsePoint(data: unknown): GeoPoint | null {
  if (!data || typeof data !== 'object') return null
  const lat = Number((data as { lat?: unknown }).lat)
  const lng = Number((data as { lon?: unknown }).lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

async function nominatimFetch(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      // Nominatim usage policy — identify the app.
      'User-Agent': 'StarforgeMaps/0.1 (local; contact=admin@localhost)',
    },
    next: { revalidate: 86400 },
  })
  if (!res.ok) return null
  return res.json()
}

export function createLeafletOsmMapProvider(): MapProvider {
  return {
    id: 'leaflet-osm',
    async geocode(query: string) {
      const q = query.trim()
      if (!q) return null
      try {
        const url = `${NOMINATIM}/search?format=json&limit=1&q=${encodeURIComponent(q)}`
        const data = await nominatimFetch(url)
        if (!Array.isArray(data) || !data[0]) return null
        return parsePoint(data[0])
      } catch {
        return null
      }
    },
    async reverseGeocode(point: GeoPoint) {
      try {
        const url = `${NOMINATIM}/reverse?format=json&lat=${encodeURIComponent(String(point.lat))}&lon=${encodeURIComponent(String(point.lng))}`
        const data = await nominatimFetch(url)
        if (!data || typeof data !== 'object') return null
        const label = (data as { display_name?: unknown }).display_name
        return typeof label === 'string' && label.trim() ? label.trim() : null
      } catch {
        return null
      }
    },
    clientConfig(): MapClientConfig {
      return {
        provider: 'leaflet-osm',
        publicKeyEnv: '',
        defaultStyle: 'osm-standard',
        tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        tileAttribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        defaultZoom: 13,
      }
    },
  }
}
