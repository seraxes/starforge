import React from 'react'

import { getMapProvider } from '@/core/maps'
import type { MapMarker } from '@/core/maps/types'
import { MapView } from '@/modules/maps/MapView'

import type { EventCardModel } from './event-card-model'
import { EventTableList } from './EventTableList'

type Props = {
  events: EventCardModel[]
  mapsEnabled: boolean
}

/** Map pins + compact table under (ASN map view, denser). */
export async function EventsMapPanel({ events, mapsEnabled }: Props) {
  if (!mapsEnabled) {
    return (
      <section className="sf-events-map-panel" aria-label="Event map">
        <p className="sf-event-list-empty settings-hint">
          Map view needs the Maps module enabled.
        </p>
        <EventTableList events={events} />
      </section>
    )
  }

  const provider = await getMapProvider()
  const clientConfig = provider.clientConfig()
  const markers: MapMarker[] = []
  const seen = new Set<string>()
  for (const event of events) {
    if (event.latitude == null || event.longitude == null) continue
    const key = event.venueId || `${event.latitude},${event.longitude}`
    if (seen.has(key)) continue
    seen.add(key)
    markers.push({
      id: key,
      lat: event.latitude,
      lng: event.longitude,
      label: event.venueName || event.title,
      href: event.href,
    })
  }

  return (
    <section className="sf-events-map-panel" aria-label="Event map">
      {markers.length === 0 ? (
        <p className="sf-event-list-empty settings-hint">
          No venue coordinates yet — add latitude/longitude on venues.
        </p>
      ) : (
        <MapView markers={markers} clientConfig={clientConfig} height="22rem" />
      )}
      <div className="sf-events-map-table">
        <EventTableList events={events} />
      </div>
    </section>
  )
}
