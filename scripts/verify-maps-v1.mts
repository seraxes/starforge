/**
 * Smoke: product:maps v1 — MapProvider + map particle + venue geo.
 * Run: npm run verify:maps-v1
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

mustExist('src/core/maps/index.ts')
mustExist('src/core/maps/types.ts')
mustExist('src/core/maps/leaflet-osm.ts')
mustExist('src/modules/maps/manifest.ts')
mustExist('src/modules/maps/particle-manifest.ts')
mustExist('src/modules/maps/MapView.tsx')
mustExist('src/core/db/migrations/0006_venue_geo.sql')

const allowlist = read('starforge.modules.json')
assert.match(allowlist, /"product:maps"/)
assert.match(allowlist, /"map"/)

const toggles = read('src/core/settings/module-toggles.ts')
assert.match(toggles, /maps:\s*'product:maps'/)

const schema = read('src/modules/events/schema.ts')
assert.match(schema, /latitude/)
assert.match(schema, /longitude/)

const actions = read('src/modules/events/actions.ts')
assert.match(actions, /geocodeVenueAction/)

const detail = read('src/app/(frontend)/(public)/[locale]/events/[slug]/page.tsx')
assert.match(detail, /EventVenueMap/)

const index = read('src/modules/manifest-index.ts')
assert.match(index, /maps\/manifest/)
assert.match(index, /maps\/particle-manifest/)

console.log('verify-maps-v1: ok')
