/**
 * Smoke: product:events PR2 — public pages + event-list / event-detail particles.
 * Run: npm run verify:events-pr2
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

mustExist('src/modules/events/public/EventList.tsx')
mustExist('src/modules/events/public/EventDetail.tsx')
mustExist('src/modules/events/particles/event-list-module.ts')
mustExist('src/modules/events/particles/event-detail-module.ts')
mustExist('src/modules/events/particles/event-list-manifest.ts')
mustExist('src/modules/events/particles/event-detail-manifest.ts')
mustExist('src/app/(frontend)/(public)/[locale]/events/page.tsx')
mustExist('src/app/(frontend)/(public)/[locale]/events/[slug]/page.tsx')

const store = read('src/modules/events/store.ts')
assert.match(store, /listPublishedEvents/)
assert.match(store, /findPublishedEventByPublicKey/)
assert.match(store, /filterEventsForViewer/)

const allowlist = read('starforge.modules.json')
assert.match(allowlist, /"event-list"/)
assert.match(allowlist, /"event-detail"/)

const index = read('src/modules/manifest-index.ts')
assert.match(index, /event-list-manifest/)
assert.match(index, /event-detail-manifest/)

const registry = read('src/generated/module-registry.ts')
assert.match(registry, /event-list/)
assert.match(registry, /event-detail/)

const manifest = read('src/modules/events/manifest.ts')
assert.match(manifest, /href: '\/events'/)
assert.match(manifest, /key: 'public'/)

const slot = read('src/core/modules/SlotRenderer.tsx')
assert.match(slot, /event-list/)
assert.match(slot, /event-detail/)

console.log('verify-events-pr2: ok')
