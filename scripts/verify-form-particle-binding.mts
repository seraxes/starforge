/**
 * Smoke checks for SF-150 Form particle ↔ Form module binding.
 * Run: npx tsx scripts/verify-form-particle-binding.mts
 */
import assert from 'node:assert/strict'

import {
  defaultFormConfig,
  formConfigToSlotConfig,
  parseCustomFormParticleJson,
  readFormConfig,
  resolveFormParticleSource,
} from '../src/core/forms/config.ts'

// --- source inference ---
assert.equal(resolveFormParticleSource({ source: 'custom' }), 'custom')
assert.equal(resolveFormParticleSource({ source: 'definition', formId: 'contact' }), 'definition')
assert.equal(resolveFormParticleSource({ formId: 'survey' }), 'definition')
assert.equal(
  resolveFormParticleSource({
    fields: [{ id: '1', name: 'n', label: 'N', type: 'text', required: true }],
  }),
  'custom',
)
assert.equal(resolveFormParticleSource({}), 'definition')
console.log('source inference: ok')

// --- defaults ---
const defaults = defaultFormConfig()
assert.equal(defaults.source, 'definition')
assert.equal(defaults.formId, 'contact')
const roundTrip = readFormConfig(formConfigToSlotConfig(defaults))
assert.equal(roundTrip.source, 'definition')
assert.equal(roundTrip.formId, 'contact')
assert.equal(roundTrip.fields, undefined)
console.log('defaults round-trip: ok')

// --- custom fields array ---
const fromArray = parseCustomFormParticleJson([
  { name: 'email', type: 'email', label: 'Email', required: true },
  { name: 'note', type: 'textarea', label: 'Note' },
])
assert.equal(fromArray.fields.length, 2)
assert.equal(fromArray.fields[0]?.name, 'email')
console.log('custom fields array: ok')

// --- definition-shaped document ---
const fromDoc = parseCustomFormParticleJson({
  title: 'Survey',
  successMessage: 'Done',
  submitLabel: 'Go',
  fields: [
    { name: 'q1', type: 'text', label: 'Q1', required: true },
    { name: 'q2', type: 'select', label: 'Q2', options: [{ value: 'a', label: 'A' }] },
  ],
})
assert.equal(fromDoc.heading, 'Survey')
assert.equal(fromDoc.successMessage, 'Done')
assert.equal(fromDoc.submitLabel, 'Go')
assert.equal(fromDoc.fields.length, 2)
console.log('custom definition doc: ok')

// --- JSON Schema object ---
const fromSchema = parseCustomFormParticleJson({
  type: 'object',
  title: 'Schema form',
  required: ['email'],
  properties: {
    email: { type: 'string', format: 'email', title: 'Email' },
    age: { type: 'integer', title: 'Age' },
    bio: { type: 'string', maxLength: 500, title: 'Bio' },
  },
})
assert.equal(fromSchema.heading, 'Schema form')
assert.equal(fromSchema.fields.length, 3)
assert.equal(fromSchema.fields.find((f) => f.name === 'email')?.type, 'email')
assert.equal(fromSchema.fields.find((f) => f.name === 'age')?.type, 'number')
assert.equal(fromSchema.fields.find((f) => f.name === 'bio')?.type, 'textarea')
assert.equal(fromSchema.fields.find((f) => f.name === 'email')?.required, true)
console.log('custom JSON Schema: ok')

// --- custom slot round-trip ---
const customSlot = formConfigToSlotConfig({
  source: 'custom',
  heading: 'Inline',
  fields: fromArray.fields,
  successMessage: 'Thanks',
  submitLabel: 'Send',
  useSiteCaptchaDefault: true,
})
assert.equal(customSlot.source, 'custom')
assert.equal(customSlot.formId, undefined)
assert.ok(Array.isArray(customSlot.fields))
const customRead = readFormConfig(customSlot)
assert.equal(customRead.source, 'custom')
assert.equal(customRead.formId, undefined)
assert.equal(customRead.fields?.length, 2)
console.log('custom slot round-trip: ok')

// --- legacy slots without source ---
const legacyDef = readFormConfig({ formId: 'ticket', heading: 'Ticket' })
assert.equal(legacyDef.source, 'definition')
assert.equal(legacyDef.formId, 'ticket')
const legacyInline = readFormConfig({
  fields: [{ name: 'x', type: 'text', label: 'X', required: true }],
})
assert.equal(legacyInline.source, 'custom')
assert.ok((legacyInline.fields?.length ?? 0) >= 1)
console.log('legacy inference: ok')

assert.throws(() => parseCustomFormParticleJson({}), /Custom JSON/)
assert.throws(() => parseCustomFormParticleJson([]), /at least one field/)
console.log('reject invalid: ok')

console.log('verify-form-particle-binding: all ok')
