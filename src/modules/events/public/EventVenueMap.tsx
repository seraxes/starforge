import React from 'react'

import { getMapProvider } from '@/core/maps'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { MapView } from '@/modules/maps/MapView'

type Props = {
  latitude: number
  longitude: number
  label?: string
}

/** Event detail venue pin — no-ops when product:maps is off. */
export async function EventVenueMap({ latitude, longitude, label }: Props) {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.maps)) {
    return null
  }

  const provider = await getMapProvider()
  const clientConfig = provider.clientConfig()

  return (
    <section className="sf-event-venue-map" aria-label="Venue map">
      <h2 className="sf-event-venue-map-heading">Location</h2>
      <MapView
        markers={[{ lat: latitude, lng: longitude, label: label || 'Venue' }]}
        clientConfig={clientConfig}
        height="14rem"
      />
    </section>
  )
}
