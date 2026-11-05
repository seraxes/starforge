/**
 * Smoke-check Form builder row layout: legacy migrate + multi-col normalize + public helpers.
 */
import assert from 'node:assert/strict'

import { normalizeFormDefinitionDocument, normalizeFormSections } from '../src/core/forms/definition.ts'
import {
  moveFieldInSections,
  resizeRowColumns,
  sectionFieldNames,
} from '../src/core/forms/rows.ts'
import type { FormFieldDef } from '../src/core/forms/types.ts'

const fields: FormFieldDef[] = [
  { name: 'first', label: 'First', type: 'text' },
  { name: 'last', label: 'Last', type: 'text' },
  { name: 'email', label: 'Email', type: 'email' },
]

const legacy = normalizeFormSections(
  [{ id: 'sec_main', label: 'Fields', fieldNames: ['first', 'last', 'email'] }],
  fields,
)
assert.equal(legacy[0]!.rows.length, 3, 'legacy fieldNames → 3 full-width rows')
assert.ok(legacy[0]!.rows.every((r) => r.columns.length === 1 && r.columns[0]!.width === 100))

const joined = moveFieldInSections(legacy, 'last', {
  sectionId: 'sec_main',
  rowId: legacy[0]!.rows[0]!.id,
  index: 1,
})
assert.equal(joined[0]!.rows[0]!.columns.length, 2)
assert.equal(joined[0]!.rows[0]!.columns[0]!.width, 50)
assert.equal(joined[0]!.rows[0]!.columns[1]!.width, 50)

const resized = resizeRowColumns(joined, 'sec_main', joined[0]!.rows[0]!.id, 0, 66)
assert.equal(resized[0]!.rows[0]!.columns[0]!.width, 66)
assert.equal(resized[0]!.rows[0]!.columns[1]!.width, 34)

const doc = normalizeFormDefinitionDocument({
  version: 1,
  preset: 'blank',
  title: 'Row demo',
  fields,
  sections: resized,
  successMessage: 'ok',
  submitLabel: 'Send',
  useSiteCaptchaDefault: true,
})
assert.deepEqual(sectionFieldNames(doc.sections![0]!), ['first', 'last', 'email'])
assert.equal(doc.sections![0]!.fieldNames, undefined, 'legacy fieldNames stripped on normalize')

console.log('verify-form-row-layout: pass')
