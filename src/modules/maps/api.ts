/**
 * product:maps client door.
 *
 *   import { MapView, VenueLocationMap } from '@/modules/maps/api'
 *   import { EventLiveMap } from '@/modules/maps'
 *
 * MapView and VenueLocationMap are client components. EventLiveMap is a server
 * component (it reads the live room). It lives on the maps barrel, not on
 * `api.server`: a re-export from the server door would load `leaflet.css` into
 * every catalog and route import, and Node boot cannot load that CSS file.
 * This file does not import `./api.server` or `./index`.
 */

export { MapView, type MapViewProps } from './MapView'
export {
  VenueLocationMap,
  type VenueLocationMapProps,
} from './VenueLocationMap'
