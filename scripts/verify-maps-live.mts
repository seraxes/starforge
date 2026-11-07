/**
 * Smoke: product:maps live tactical rooms + Realtime map ACL hooks + Capacitor shell.
 * Run: npm run verify:maps-live
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function read(rel: string): string {
  return readFileSync(path.join(ROOT, rel), 'utf8')
}

function mustExist(rel: string) {
  assert.ok(existsSync(path.join(ROOT, rel)), `missing ${rel}`)
}

mustExist('src/modules/maps/schema.ts')
mustExist('src/core/db/migrations/0012_map_live_tactical.sql')
mustExist('src/modules/maps/store.ts')
mustExist('src/modules/maps/actions.ts')
mustExist('src/modules/maps/admin/MapsLiveRoomsPage.tsx')
mustExist('src/modules/maps/admin/MapsLiveRoomEditPage.tsx')
mustExist('src/modules/maps/live-map-module.ts')
mustExist('src/modules/maps/live-map-particle-manifest.ts')
mustExist('src/modules/maps/public/LiveMapPanel.tsx')
mustExist('src/modules/maps/public/EventLiveMap.tsx')
mustExist('src/modules/maps/realtime-acl.ts')
mustExist('src/app/api/maps/live/[roomId]/join/route.ts')
mustExist('src/app/api/maps/live/[roomId]/ingest/route.ts')
mustExist('src/core/realtime/redis-fanout.ts')
mustExist('apps/asn-capacitor/README.md')
mustExist('docs/project-context/docs/maps-live-tactical.md')

const headers = read('src/core/security/headers.ts')
assert.match(headers, /geolocation=\(self\)/)

const allowlist = read('starforge.modules.json')
assert.match(allowlist, /"live-map"/)

const journal = read('src/core/db/migrations/meta/_journal.json')
assert.match(journal, /0012_map_live_tactical/)

const index = read('src/modules/manifest-index.ts')
assert.match(index, /live-map-particle-manifest/)

const realtimeRoute = read('src/app/api/realtime/route.ts')
assert.match(realtimeRoute, /canSubscribeMapChannel/)
assert.match(realtimeRoute, /filterSubscribableChannelsAsync/)

const eventPage = read(
  'src/app/(frontend)/(public)/[locale]/events/[slug]/page.tsx',
)
assert.match(eventPage, /EventLiveMap/)

const acl = read('src/core/acl/types.ts')
assert.match(acl, /admin\.maps/)

const sw = read('src/sw.ts')
assert.match(sw, /sf-pwa-map-tiles/)

console.log('verify-maps-live: ok')
