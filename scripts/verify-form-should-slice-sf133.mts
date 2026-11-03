/**
 * Smoke checks for SF-133 Form Should slice (CSV, redirect sanitize, ticket preset).
 * Run: npx tsx scripts/verify-form-should-slice-sf133.mts
 */
import assert from 'node:assert/strict'

import {
  buildFormSubmissionsCsv,
  escapeCsvCell,
  normalizeSuccessRedirectUrl,
} from '../src/core/forms/csv.ts'
import { fieldsForPreset, FORM_PRESETS, getFormPresetMeta } from '../src/core/forms/presets.ts'
import { normalizeFormDefinitionDocument } from '../src/core/forms/definition.ts'
import type { FormSubmissionRecord } from '../src/core/forms/types.ts'

// --- CSV ---
assert.equal(escapeCsvCell('plain'), 'plain')
assert.equal(escapeCsvCell('a,b'), '"a,b"')
assert.equal(escapeCsvCell('say "hi"'), '"say ""hi"""')

const sample: FormSubmissionRecord[] = [
  {
    id: 'sub-1',
    formKey: 'slot_a',
    definitionId: 'ticket',
    layoutId: null,
    slotId: null,
    payload: { name: 'Ada', subject: 'Broken, link', priority: 'high' },
    ipAddress: '127.0.0.1',
    userAgent: null,
    createdAt: new Date('2026-01-02T03:04:05.000Z'),
  },
]

const csv = buildFormSubmissionsCsv({
  submissions: sample,
  fields: fieldsForPreset('ticket'),
  bom: false,
})
assert.ok(csv.includes('id,createdAt,formKey,definitionId,ipAddress'))
assert.ok(csv.includes('name'))
assert.ok(csv.includes('subject'))
assert.ok(csv.includes('"Broken, link"'))
assert.ok(csv.startsWith('id,'))
console.log('csv: ok')

// --- success redirect sanitize ---
assert.equal(normalizeSuccessRedirectUrl('/thanks'), '/thanks')
assert.equal(normalizeSuccessRedirectUrl('/app/foo?x=1#y'), '/app/foo?x=1#y')
assert.equal(normalizeSuccessRedirectUrl('https://evil.example/'), undefined)
assert.equal(normalizeSuccessRedirectUrl('//evil.example'), undefined)
assert.equal(normalizeSuccessRedirectUrl('thanks'), undefined)
assert.equal(normalizeSuccessRedirectUrl('/\\evil'), undefined)

const doc = normalizeFormDefinitionDocument({
  version: 1,
  preset: 'contact',
  title: 'Contact',
  fields: fieldsForPreset('contact'),
  successMessage: 'ok',
  submitLabel: 'Send',
  useSiteCaptchaDefault: true,
  successRedirectUrl: '//evil.example',
})
assert.equal(doc.successRedirectUrl, undefined)

const docOk = normalizeFormDefinitionDocument({
  ...doc,
  successRedirectUrl: '/thanks',
})
assert.equal(docOk.successRedirectUrl, '/thanks')
console.log('successRedirectUrl: ok')

// --- ticket preset is real (not stub) ---
const ticketMeta = getFormPresetMeta('ticket')
assert.equal(ticketMeta.stub, undefined)
assert.ok(!FORM_PRESETS.find((p) => p.id === 'ticket')?.stub)
const ticketFields = fieldsForPreset('ticket')
const names = ticketFields.map((f) => f.name)
assert.ok(names.includes('subject'))
assert.ok(names.includes('priority'))
assert.ok(names.includes('category'))
assert.ok(names.includes('details'))
assert.ok(names.includes('attachment'))
assert.equal(ticketFields.find((f) => f.name === 'attachment')?.type, 'file')
assert.ok(ticketFields.find((f) => f.name === 'subject')?.stringConstraints?.minLength)
console.log('ticket preset: ok')

console.log('verify-form-should-slice-sf133: pass')
