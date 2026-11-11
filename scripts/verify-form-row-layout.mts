/**
 * Smoke-check Form builder row layout: legacy migrate + multi-col + opt-in empty rows.
 */
import assert from 'node:assert/strict'

import { normalizeFormDefinitionDocument, normalizeFormSections } from '../src/modules/forms/definition.ts'
import {
  addFieldToRow,
  appendEmptyRowToSection,
  moveFieldInSections,
  removeEmptyRowFromSection,
  resizeRowColumns,
  rowIsEmpty,
  sectionFieldNames,
} from '../src/modules/forms/rows.ts'
import type { FormFieldDef } from '../src/modules/forms/types.ts'

const fields: FormFieldDef[] = [
  { name: 'first', label: 'First', type: 'text' },
  { name: 'last', label: 'Last', type: 'text' },
  { name: 'email', label: 'Email', type: 'email' },
]

const legacy = normalizeFormSections(
  [{ id: 'sec_main', label: 'Fields', fieldNames: ['first', 'last', 'email'] }],
  fields,
)
assert.equal(legacy[0]!.rows.length, 3, 'legacy fieldNames → 3 full-width rows (no auto empty)')
assert.ok(legacy[0]!.rows.every((r) => r.columns.length === 1 && r.columns[0]!.width === 100))

const opened = appendEmptyRowToSection(legacy, 'sec_main')
assert.ok(rowIsEmpty(opened[0]!.rows[3]!), '+ row opens trailing empty')
const emptyId = opened[0]!.rows[3]!.id

// Palette-style drop onto open empty row.
const fromPalette = addFieldToRow(opened, 'sec_main', emptyId, 'phone')
assert.deepEqual(fromPalette[0]!.rows.find((r) => r.id === emptyId)?.columns, [
  { fieldName: 'phone', width: 100 },
])

// Placed-field move onto a fresh open empty row.
const reopen = appendEmptyRowToSection(legacy, 'sec_main')
const reopenEmpty = reopen[0]!.rows[reopen[0]!.rows.length - 1]!.id
const fromPlaced = moveFieldInSections(reopen, 'email', {
  sectionId: 'sec_main',
  rowId: reopenEmpty,
  index: 0,
})
assert.deepEqual(fromPlaced[0]!.rows.find((r) => r.id === reopenEmpty)?.columns, [
  { fieldName: 'email', width: 100 },
])

const closed = removeEmptyRowFromSection(opened, 'sec_main', emptyId)
assert.equal(closed[0]!.rows.length, 3, '− row closes empty')

const joined = moveFieldInSections(legacy, 'last', {
  sectionId: 'sec_main',
  rowId: legacy[0]!.rows[0]!.id,
  index: 1,
})
assert.equal(joined[0]!.rows[0]!.columns.length, 2)
assert.equal(joined[0]!.rows[0]!.columns[0]!.width, 50)
assert.equal(joined[0]!.rows[0]!.columns[1]!.width, 50)

// Palette-style drop onto a filled row → even columns.
const ontoFilled = addFieldToRow(joined, 'sec_main', joined[0]!.rows[0]!.id, 'phone')
assert.equal(ontoFilled[0]!.rows[0]!.columns.length, 3)
assert.equal(
  ontoFilled[0]!.rows[0]!.columns.reduce((sum, c) => sum + c.width, 0),
  100,
)

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
