/**
 * Smoke checks for captcha as a Form builder field type.
 * Run: npx tsx scripts/verify-captcha-form-field.mts
 */
import assert from 'node:assert/strict'

import {
  createFieldDraft,
  formHasCaptchaField,
  normalizeFormFields,
} from '../src/modules/forms/definition.ts'
import { evaluateAndValidateFields } from '../src/modules/forms/evaluate.ts'
import { isFormFieldType, fieldsToJsonSchema } from '../src/modules/forms/schema-json.ts'

assert.equal(isFormFieldType('captcha'), true)
assert.equal(isFormFieldType('turnstile'), false)
console.log('field type registry: ok')

const draft = createFieldDraft('captcha')
assert.equal(draft.type, 'captcha')
assert.equal(draft.required, false)
assert.match(draft.name, /^captcha_/)
assert.equal(draft.label, 'Captcha')
console.log('createFieldDraft(captcha): ok')

const fields = normalizeFormFields([
  { name: 'email', type: 'email', label: 'Email', required: true },
  { name: 'botcheck', type: 'captcha', label: 'Captcha', required: true },
])
assert.equal(fields.length, 2)
assert.equal(fields[1]?.type, 'captcha')
assert.equal(fields[1]?.required, false, 'captcha never user-required')
assert.equal(formHasCaptchaField(fields), true)
assert.equal(formHasCaptchaField(fields.filter((f) => f.type !== 'captcha')), false)
console.log('normalize + formHasCaptchaField: ok')

const schema = fieldsToJsonSchema(fields)
assert.equal(schema.properties?.botcheck?.['x-sf-fieldType'], 'captcha')
assert.ok(!(schema.required ?? []).includes('botcheck'))
console.log('json schema: ok')

const evaluated = evaluateAndValidateFields(fields, {
  email: 'hi@example.com',
  botcheck: 'token-noise',
})
assert.equal(evaluated.error, undefined)
assert.equal(evaluated.values.botcheck, '')
console.log('evaluate strips captcha value: ok')

console.log('verify-captcha-form-field: all ok')
