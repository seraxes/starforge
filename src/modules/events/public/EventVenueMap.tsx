import React from 'react'

import { getMapProvider } from '@/core/maps'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { MapView } from '@/modules/maps/MapView'

type Props = {
  latitude: number
  longitude: number
  label?: string
  /** Empty string hides the heading (when nested under EventDetail Location). */
  heading?: string
}

/** Event detail venue pin — no-ops when product:maps is off. */
export async function EventVenueMap({
  latitude,
  longitude,
  label,
  heading = 'Location',
}: Props) {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.maps)) {
    return null
  }

  const provider = await getMapProvider()
  const clientConfig = provider.clientConfig()
  const title = heading.trim()

  return (
    <div className="sf-event-venue-map" aria-label={title || 'Venue map'}>
      {title ? <h2 className="sf-event-venue-map-heading">{title}</h2> : null}
      <MapView
        markers={[{ lat: latitude, lng: longitude, label: label || 'Venue' }]}
        clientConfig={clientConfig}
        height="14rem"
      />
    </div>
  )
}
