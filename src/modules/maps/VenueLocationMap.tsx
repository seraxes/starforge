'use client'

import React, { useEffect, useId, useRef } from 'react'
import 'leaflet/dist/leaflet.css'

import type { MapClientConfig } from '@/core/maps/types'

export type VenueLocationMapProps = {
  clientConfig: MapClientConfig
  latitude: number | null
  longitude: number | null
  onPick: (lat: number, lng: number) => void
  height?: string
  className?: string
  disabled?: boolean
}

const DEFAULT_CENTER = { lat: 47.5, lng: 19.05 }

/**
 * Admin pin picker — click map or drag marker to set venue lat/lng.
 * Reuses product:maps Leaflet stack (no second map core).
 */
export function VenueLocationMap({
  clientConfig,
  latitude,
  longitude,
  onPick,
  height = '16rem',
  className = '',
  disabled = false,
}: VenueLocationMapProps) {
  const mapElId = useId().replace(/:/g, '')
  const containerRef = useRef<HTMLDivElement>(null)
  const onPickRef = useRef(onPick)
  onPickRef.current = onPick

  const mapRef = useRef<import('leaflet').Map | null>(null)
  const markerRef = useRef<import('leaflet').Marker | null>(null)
  const LRef = useRef<typeof import('leaflet') | null>(null)
  const coordsRef = useRef({ latitude, longitude })
  coordsRef.current = { latitude, longitude }

  function syncMarker(
    map: import('leaflet').Map,
    L: typeof import('leaflet'),
    lat: number | null,
    lng: number | null,
  ) {
    const hasPin =
      typeof lat === 'number' &&
      Number.isFinite(lat) &&
      typeof lng === 'number' &&
      Number.isFinite(lng)

    if (!hasPin) {
      if (markerRef.current) {
        markerRef.current.remove()
        markerRef.current = null
      }
      return
    }

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng])
    } else {
      const marker = L.marker([lat, lng], { draggable: true }).addTo(map)
      marker.on('dragend', () => {
        const pos = marker.getLatLng()
        onPickRef.current(pos.lat, pos.lng)
      })
      markerRef.current = marker
    }

    const z = Math.max(map.getZoom(), 14)
    map.setView([lat, lng], z, { animate: false })
  }

  // Mount map once (or when tiles / disabled change).
  useEffect(() => {
    const el = containerRef.current
    if (!el || disabled) return

    let cancelled = false

    ;(async () => {
      const L = await import('leaflet')
      LRef.current = L
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      if (cancelled || !containerRef.current) return

      const map = L.map(containerRef.current, {
        scrollWheelZoom: false,
      }).setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], clientConfig.defaultZoom)

      L.tileLayer(clientConfig.tileUrl, {
        attribution: clientConfig.tileAttribution,
        maxZoom: 19,
      }).addTo(map)

      map.on('click', (e: { latlng: { lat: number; lng: number } }) => {
        onPickRef.current(e.latlng.lat, e.latlng.lng)
      })

      mapRef.current = map
      const { latitude: lat, longitude: lng } = coordsRef.current
      syncMarker(map, L, lat, lng)
      requestAnimationFrame(() => {
        map.invalidateSize()
      })
    })().catch((error) => {
      console.error('[maps] VenueLocationMap failed to load', error)
    })

    return () => {
      cancelled = true
      markerRef.current = null
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
      LRef.current = null
    }
  }, [
    clientConfig.defaultZoom,
    clientConfig.tileAttribution,
    clientConfig.tileUrl,
    disabled,
  ])

  // Sync marker / view when coords change (without remounting the map).
  useEffect(() => {
    const map = mapRef.current
    const L = LRef.current
    if (!map || !L || disabled) return
    syncMarker(map, L, latitude, longitude)
  }, [disabled, latitude, longitude])

  if (disabled) {
    return (
      <p className="settings-hint">
        Enable <strong>Maps</strong> under Settings → Modules to place a pin on the map.
      </p>
    )
  }

  const hasPin =
    typeof latitude === 'number' &&
    Number.isFinite(latitude) &&
    typeof longitude === 'number' &&
    Number.isFinite(longitude)

  return (
    <div className={['sf-venue-location-map', className].filter(Boolean).join(' ')}>
      <p className="settings-hint">
        {hasPin
          ? 'Drag the marker or click the map to move the pin.'
          : 'Click the map to place a pin (defaults to Budapest until set).'}
      </p>
      <div
        id={`sf-venue-map-${mapElId}`}
        ref={containerRef}
        className="sf-map-view-canvas sf-venue-location-map-canvas"
        style={{ height }}
        role="region"
        aria-label="Venue location map"
      />
    </div>
  )
}
