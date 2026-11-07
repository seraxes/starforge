/**
 * Minimal bridge stub — replace with Capacitor Geolocation + background plugin
 * when packaging Android/iOS builds.
 */
globalThis.StarforgeLiveMap = {
  onSession(payload) {
    console.info('[asn-capacitor] live map session', payload)
    // Native: start/stop background watch → POST /api/maps/live/{roomId}/ingest
  },
}
