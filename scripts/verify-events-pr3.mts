/**
 * Smoke: product:events PR3 — registration + email trigger + public form bind.
 * Run: npm run verify:events-pr3
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

mustExist('src/modules/events/registrations.ts')
mustExist('src/modules/events/form-hooks.ts')
mustExist('src/modules/events/registration-form.ts')
mustExist('src/modules/events/public/EventRegistrationForm.tsx')
mustExist('src/core/db/migrations/0005_event_registrations.sql')

const schema = read('src/modules/events/schema.ts')
assert.match(schema, /sfEventRegistrations|sf_event_registrations/)

const hooks = read('src/modules/events/form-hooks.ts')
assert.match(hooks, /event-registration/)
assert.match(hooks, /product:events\/registered/)
assert.match(hooks, /ensureEventsFormHooks/)

const triggers = read('src/modules/email-manager/triggers.ts')
assert.match(triggers, /product:events\/registered/)

const detail = read('src/app/(frontend)/(public)/[locale]/events/[slug]/page.tsx')
assert.match(detail, /EventRegistrationForm/)
assert.match(detail, /ensureEventsFormHooks/)

const actions = read('src/modules/events/actions.ts')
assert.match(actions, /seedEventsEmailStartersAction/)

const settings = read('src/modules/events/admin/events-settings-form.tsx')
assert.match(settings, /seedEventsEmailStartersAction/)

const formActions = read('src/modules/forms/actions.ts')
assert.match(formActions, /ensureEventsFormHooks/)

const journal = read('src/core/db/migrations/meta/_journal.json')
assert.match(journal, /0005_event_registrations/)

console.log('verify-events-pr3: ok')
