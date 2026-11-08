# ASN Capacitor shell (background live map)

Field client for Airsoft Nexus / Starforge **TacMap** (Tactical Maps).

Browser PWA cannot reliably keep GPS running in the background (especially iOS). This shell wraps the Starforge web app and uses Capacitor Geolocation (with background mode) while a live map **session** is active — Join until Leave.

## Scope

- Loads the Starforge site (`server.url`) in a WebView
- Bridges background location → existing `/api/maps/live/{roomId}/ingest` with the Better Auth cookie / token
- Does **not** fork Maps domain logic — Starforge owns rooms, roster, ACL, RealtimePort

## Setup (when building the native app)

```bash
cd apps/asn-capacitor
npm install
npx cap add android
npx cap add ios
# Set CAPACITOR_SERVER_URL to your Starforge origin
npx cap sync
```

Required plugins (install when implementing builds):

- `@capacitor/geolocation`
- `@capacitor-community/background-geolocation` (or equivalent) for true background updates

## Web bridge

The live map UI notifies:

```js
globalThis.StarforgeLiveMap?.onSession?.({ roomId, active: true | false })
```

Native code should start/stop background tracking from that signal and POST ingest payloads to Starforge.

## Consent

OS location permission + in-app Join consent remain mandatory. Leave map must stop native tracking immediately.
