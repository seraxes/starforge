/**
 * Smoke: Form presets P2 — survey / event-registration / voting real seeds +
 * registerFormPreset / onSubmitted seam (modules/forms/api).
 * Run: npx tsx scripts/verify-form-presets-p2.mts
 */
import assert from 'node:assert/strict'

import {
  clearFormPresetRegistrations,
  registerFormPreset,
  runFormPresetOnSubmitted,
} from '../src/modules/forms/api.ts'
import {
  fieldsForPreset,
  FORM_PRESETS,
  getFormPresetMeta,
  listFormPresetMetas,
  presetSeedFields,
} from '../src/core/forms/presets.ts'
import { emptyFormDefinitionDocument } from '../src/core/forms/definition.ts'

clearFormPresetRegistrations()

for (const id of ['survey', 'event-registration', 'voting'] as const) {
  assert.equal(getFormPresetMeta(id).stub, undefined)
  assert.ok(!FORM_PRESETS.find((p) => p.id === id)?.stub)
  const fields = fieldsForPreset(id)
  assert.ok(fields.length >= 3, `${id} should ship a thin solid seed`)
  const doc = emptyFormDefinitionDocument(id)
  assert.equal(doc.preset, id)
  assert.equal(doc.fields.length, fields.length)
  assert.ok(Object.keys(doc.schema.properties).length > 0)
  assert.ok(!/stub/i.test(doc.description ?? ''))
}

const surveyNames = fieldsForPreset('survey').map((f) => f.name)
assert.ok(surveyNames.includes('rating'))
assert.ok(surveyNames.includes('feedback'))

const eventNames = fieldsForPreset('event-registration').map((f) => f.name)
assert.ok(eventNames.includes('guests'))
assert.ok(eventNames.includes('attendance'))
assert.ok(eventNames.includes('event_id'))
assert.equal(
  fieldsForPreset('event-registration').find((f) => f.name === 'event_id')?.type,
  'hidden',
)

const voteNames = fieldsForPreset('voting').map((f) => f.name)
assert.ok(voteNames.includes('choice'))
assert.ok(voteNames.includes('poll_id'))

const adminIds = listFormPresetMetas().map((p) => p.id)
for (const id of ['contact', 'survey', 'event-registration', 'voting', 'ticket', 'blank']) {
  assert.ok(adminIds.includes(id as (typeof adminIds)[number]))
}

const seed = presetSeedFields('event-registration')
assert.equal(seed.meta.submitLabel, 'Register')

let hooked = false
registerFormPreset({
  id: 'voting',
  label: 'Voting',
  onSubmitted: () => {
    hooked = true
  },
})
await runFormPresetOnSubmitted({
  presetId: 'voting',
  definitionId: 'v1',
  formKey: 'k',
  submissionId: 's1',
  userId: 'u1',
  payload: { choice: 'a' },
})
assert.equal(hooked, true)

clearFormPresetRegistrations()
console.log('verify-form-presets-p2: pass')
