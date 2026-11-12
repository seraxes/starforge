/**
 * Smoke: product:events densify — ticket tiers + registrants admin.
 * Run: npm run verify:events-densify
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

mustExist('src/modules/events/tiers.ts')
mustExist('src/modules/events/admin/EventsTiersPage.tsx')
mustExist('src/modules/events/admin/EventsRegistrantsPage.tsx')
mustExist('src/modules/events/admin/tiers-manager.tsx')
mustExist('src/modules/events/admin/registrants-manager.tsx')
mustExist('src/core/db/migrations/0007_event_ticket_tiers.sql')

const schema = read('src/modules/events/schema.ts')
assert.match(schema, /sfEventTicketTiers|sf_event_ticket_tiers/)
assert.match(schema, /ticketTierId|ticket_tier_id/)

const journal = read('src/core/db/migrations/meta/_journal.json')
assert.match(journal, /0007_event_ticket_tiers/)

const tiers = read('src/modules/events/tiers.ts')
assert.match(tiers, /createTicketTier/)
assert.match(tiers, /countRegisteredGuestsForTier/)

const regs = read('src/modules/events/registrations.ts')
assert.match(regs, /ticketTierId/)
assert.match(regs, /updateRegistrationStatus/)

const form = read('src/modules/events/registration-form.ts')
assert.match(form, /ticket_tier_id/)
assert.match(form, /listPublicTicketTiersForEvent|listTicketTiersForEvent/)

const hooks = read('src/modules/events/form-hooks.ts')
assert.match(hooks, /ticket_tier_id|ticketTierId/)

const actions = read('src/modules/events/actions.ts')
assert.match(actions, /createTicketTierAction/)
assert.match(actions, /updateRegistrationStatusAction/)

const manifest = read('src/modules/events/manifest.ts')
assert.match(manifest, /path: 'events\/tiers'/)
assert.match(manifest, /path: 'events\/registrants'/)
assert.match(manifest, /href: '\/admin\/events\/tiers'/)
assert.match(manifest, /href: '\/admin\/events\/registrants'/)

const nav = read('src/modules/events/admin/events-admin-nav.tsx')
assert.match(nav, /tiers/)
assert.match(nav, /registrants/)

mustExist('src/app/(frontend)/admin/(modules)/events/tiers/page.tsx')
mustExist('src/app/(frontend)/admin/(modules)/events/registrants/page.tsx')

const pkg = read('package.json')
assert.match(pkg, /verify:events-densify/)

console.log('verify-events-densify: ok')
