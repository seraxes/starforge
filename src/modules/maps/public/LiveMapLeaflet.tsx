'use client'

import React, { useEffect, useId, useRef } from 'react'
import 'leaflet/dist/leaflet.css'

import type { MapClientConfig } from '@/core/maps/types'

export type LiveMarker = {
  id: string
  lat: number
  lng: number
  label?: string
  color?: string
}

type Props = {
  clientConfig: MapClientConfig
  markers: LiveMarker[]
  center?: { lat: number; lng: number }
  height?: string
}

/** Leaflet surface for live tactical markers (teammates + overlay points). */
export function LiveMapLeaflet({
  clientConfig,
  markers,
  center,
  height = '24rem',
}: Props) {
  const mapElId = useId().replace(/:/g, '')
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('leaflet').Map | null>(null)
  const layerRef = useRef<import('leaflet').LayerGroup | null>(null)
  const LRef = useRef<typeof import('leaflet') | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let cancelled = false

    ;(async () => {
      const L = await import('leaflet')
      LRef.current = L
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:
          'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })
      if (cancelled || !containerRef.current) return

      const start = center ||
        (markers[0]
          ? { lat: markers[0].lat, lng: markers[0].lng }
          : { lat: 47.5, lng: 19.05 })

      const map = L.map(containerRef.current, { scrollWheelZoom: false }).setView(
        [start.lat, start.lng],
        clientConfig.defaultZoom ?? 14,
      )
      L.tileLayer(clientConfig.tileUrl, {
        attribution: clientConfig.tileAttribution,
        maxZoom: 19,
      }).addTo(map)
      const layer = L.layerGroup().addTo(map)
      mapRef.current = map
      layerRef.current = layer
    })()

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      layerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init once
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    const L = LRef.current
    if (!map || !layer || !L) return
    layer.clearLayers()
    const bounds: import('leaflet').LatLngExpression[] = []
    for (const m of markers) {
      const color = m.color || '#3b82f6'
      const marker = L.circleMarker([m.lat, m.lng], {
        radius: 8,
        color,
        fillColor: color,
        fillOpacity: 0.85,
        weight: 2,
      })
      if (m.label) marker.bindPopup(m.label)
      marker.addTo(layer)
      bounds.push([m.lat, m.lng])
    }
    if (bounds.length > 1) {
      map.fitBounds(bounds as import('leaflet').LatLngBoundsExpression, {
        padding: [28, 28],
        maxZoom: 17,
      })
    } else if (bounds.length === 1) {
      map.panTo(bounds[0] as import('leaflet').LatLngExpression)
    }
  }, [markers])

  return (
    <div
      id={mapElId}
      ref={containerRef}
      className="sf-live-map-leaflet"
      style={{ height, width: '100%' }}
    />
  )
}
