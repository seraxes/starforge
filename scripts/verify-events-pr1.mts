/**
 * Smoke: product:events PR1 — schema + admin CRUD + dashboard counts.
 * Run: npm run verify:events-pr1
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

mustExist('src/modules/events/manifest.ts')
mustExist('src/modules/events/schema.ts')
mustExist('src/modules/events/store.ts')
mustExist('src/modules/events/actions.ts')
mustExist('src/modules/events/types.ts')
mustExist('src/modules/events/settings.ts')
mustExist('src/modules/events/admin/EventsListPage.tsx')
mustExist('src/modules/events/admin/EventsVenuesPage.tsx')
mustExist('src/modules/events/admin/EventsSettingsPage.tsx')
mustExist('src/modules/events/admin/events-manager.tsx')
mustExist('src/modules/events/admin/venues-manager.tsx')
mustExist('src/modules/events/admin/events-settings-form.tsx')
mustExist('src/modules/events/messages/en.json')
mustExist('src/modules/events/messages/hu.json')
mustExist('src/core/db/migrations/0004_events_venues.sql')

const manifest = read('src/modules/events/manifest.ts')
assert.match(manifest, /id: 'product:events'/)
assert.match(manifest, /path: 'events'/)
assert.match(manifest, /path: 'events\/venues'/)
assert.match(manifest, /path: 'events\/settings'/)
assert.match(manifest, /db:\s*\{\s*schema:/)
assert.match(manifest, /namespaces:\s*\['product:events'\]/)
assert.match(manifest, /label: 'Settings'/)
assert.match(manifest, /href: '\/admin\/events\/settings'/)

const schema = read('src/modules/events/schema.ts')
assert.match(schema, /sf_venues/)
assert.match(schema, /sf_events/)
assert.match(schema, /coverMediaId|cover_media_id/)
assert.match(schema, /accessTags|access_tags/)

const allowlist = read('starforge.modules.json')
assert.match(allowlist, /product:events/)

const registry = read('src/generated/module-registry.ts')
assert.match(registry, /product:events/)
assert.match(registry, /\/admin\/events/)

const eventsShim = read('src/app/(frontend)/admin/(modules)/events/page.tsx')
assert.match(eventsShim, /@\/modules\/events\/admin\/EventsListPage/)

const venuesShim = read(
  'src/app/(frontend)/admin/(modules)/events/venues/page.tsx',
)
assert.match(venuesShim, /@\/modules\/events\/admin\/EventsVenuesPage/)

const settingsShim = read(
  'src/app/(frontend)/admin/(modules)/events/settings/page.tsx',
)
assert.match(settingsShim, /@\/modules\/events\/admin\/EventsSettingsPage/)

const migration = read('src/core/db/migrations/0004_events_venues.sql')
assert.match(migration, /CREATE TABLE "sf_venues"/)
assert.match(migration, /CREATE TABLE "sf_events"/)

const stats = read('src/modules/events/dashboard/events-stats.ts')
assert.match(stats, /countUpcomingEvents/)
assert.doesNotMatch(stats, /Events module is not shipped yet/)

const widget = read('src/modules/events/dashboard/EventsUpcomingWidget.tsx')
assert.match(widget, /getTranslations\('product:events'\)/)
assert.match(widget, /openManager/)

const aclTypes = read('src/core/acl/types.ts')
assert.match(aclTypes, /admin\.events/)

const decide = read('src/core/acl/decide.ts')
assert.match(decide, /admin\.events/)
assert.match(decide, /\/events/)

const messagesEn = read('src/modules/events/messages/en.json')
assert.match(messagesEn, /openManager/)
assert.match(messagesEn, /upcomingHint/)

const pkg = read('package.json')
assert.match(pkg, /verify:events-pr1/)

const manager = read('src/modules/events/admin/venues-manager.tsx')
assert.match(manager, /MediaPicker|CoverAndAccessFields/)
assert.match(manager, /AccessTagsField|accessTags/)

const eventsManager = read('src/modules/events/admin/events-manager.tsx')
assert.match(eventsManager, /CoverAndAccessFields/)
assert.match(eventsManager, /MediaPicker|coverMediaId/)

console.log('verify-events-pr1: ok')
