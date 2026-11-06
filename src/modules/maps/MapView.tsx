'use client'

import React, { useEffect, useId, useRef } from 'react'
import 'leaflet/dist/leaflet.css'

import type { MapClientConfig, MapMarker } from '@/core/maps/types'

export type MapViewProps = {
  markers: MapMarker[]
  clientConfig: MapClientConfig
  /** Optional fixed center when markers empty. */
  center?: { lat: number; lng: number }
  zoom?: number
  height?: string
  className?: string
}

/**
 * Leaflet map client — tiles/attribution from MapProvider.clientConfig().
 */
export function MapView({
  markers,
  clientConfig,
  center,
  zoom,
  height = '16rem',
  className = '',
}: MapViewProps) {
  const mapElId = useId().replace(/:/g, '')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let cancelled = false
    let map: import('leaflet').Map | null = null

    ;(async () => {
      const L = await import('leaflet')
      // Default marker icons break under bundlers — use CDN icons.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      if (cancelled || !containerRef.current) return

      const first = markers[0]
      const start = center || (first ? { lat: first.lat, lng: first.lng } : { lat: 47.5, lng: 19.05 })
      const z = zoom ?? clientConfig.defaultZoom

      map = L.map(containerRef.current, {
        scrollWheelZoom: false,
      }).setView([start.lat, start.lng], z)

      L.tileLayer(clientConfig.tileUrl, {
        attribution: clientConfig.tileAttribution,
        maxZoom: 19,
      }).addTo(map)

      const bounds: import('leaflet').LatLngExpression[] = []
      for (const m of markers) {
        const marker = L.marker([m.lat, m.lng])
        if (m.label || m.href) {
          const title = m.label || 'Location'
          const html = m.href
            ? `<a href="${m.href}">${title}</a>`
            : title
          marker.bindPopup(html)
        }
        marker.addTo(map)
        bounds.push([m.lat, m.lng])
      }
      if (bounds.length > 1) {
        map.fitBounds(bounds as import('leaflet').LatLngBoundsExpression, {
          padding: [24, 24],
        })
      }
    })().catch((error) => {
      console.error('[maps] Leaflet failed to load', error)
    })

    return () => {
      cancelled = true
      if (map) {
        map.remove()
        map = null
      }
    }
  }, [markers, clientConfig, center, zoom])

  return (
    <div className={['sf-map-view', className].filter(Boolean).join(' ')}>
      <div
        id={`sf-map-${mapElId}`}
        ref={containerRef}
        className="sf-map-view-canvas"
        style={{ height }}
        role="region"
        aria-label="Map"
      />
    </div>
  )
}
