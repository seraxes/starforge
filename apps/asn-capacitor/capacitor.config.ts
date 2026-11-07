import type { CapacitorConfig } from '@capacitor/cli'

/**
 * ASN field shell — points WebView at Starforge.
 * Override with CAPACITOR_SERVER_URL (e.g. https://asn.example).
 */
const config: CapacitorConfig = {
  appId: 'hu.airsoftnexus.app',
  appName: 'Airsoft Nexus',
  webDir: 'www',
  server: {
    url: process.env.CAPACITOR_SERVER_URL || 'http://localhost:3000',
    cleartext: true,
  },
  plugins: {
    Geolocation: {
      // Permissions requested when Join map starts background tracking.
    },
  },
}

export default config
