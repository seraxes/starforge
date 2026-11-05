import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { normalizeFormSections } from './definition'
import {
  addFieldToRow,
  mergeRows,
  moveFieldInSections,
  removeFieldFromSections,
  resizeRowColumns,
  sectionFieldNames,
  splitFieldToOwnRow,
} from './rows'
import type { FormFieldDef } from './types'

const fields: FormFieldDef[] = [
  { name: 'name', label: 'Name', type: 'text' },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'message', label: 'Message', type: 'textarea' },
]

describe('form row layout normalize', () => {
  it('migrates legacy fieldNames to one full-width row per field', () => {
    const sections = normalizeFormSections(
      [{ id: 'sec_main', label: 'Fields', fieldNames: ['name', 'email', 'message'] }],
      fields,
    )
    assert.equal(sections.length, 1)
    assert.equal(sections[0]!.rows.length, 3)
    assert.deepEqual(
      sections[0]!.rows.map((r) => r.columns.map((c) => [c.fieldName, c.width])),
      [
        [['name', 100]],
        [['email', 100]],
        [['message', 100]],
      ],
    )
    assert.equal(sections[0]!.fieldNames, undefined)
    assert.deepEqual(sectionFieldNames(sections[0]!), ['name', 'email', 'message'])
  })

  it('keeps multi-column rows and even-fixes bad width sums', () => {
    const sections = normalizeFormSections(
      [
        {
          id: 'sec_main',
          label: 'Fields',
          rows: [
            {
              id: 'row_a',
              columns: [
                { fieldName: 'name', width: 50 },
                { fieldName: 'email', width: 50 },
              ],
            },
            {
              id: 'row_b',
              columns: [{ fieldName: 'message', width: 100 }],
            },
          ],
        },
      ],
      fields,
    )
    assert.equal(sections[0]!.rows.length, 2)
    assert.deepEqual(
      sections[0]!.rows[0]!.columns.map((c) => [c.fieldName, c.width]),
      [
        ['name', 50],
        ['email', 50],
      ],
    )
  })

  it('converts legacy 12-col widths to percent', () => {
    const sections = normalizeFormSections(
      [
        {
          id: 'sec_main',
          label: 'Fields',
          rows: [
            {
              id: 'row_a',
              columns: [
                { fieldName: 'name', width: 6 },
                { fieldName: 'email', width: 6 },
              ],
            },
          ],
        },
      ],
      fields.slice(0, 2),
    )
    const cols = sections[0]!.rows[0]!.columns
    assert.equal(cols[0]!.width + cols[1]!.width, 100)
    assert.ok(cols[0]!.width >= 5)
  })

  it('places orphan fields on the first section as full-width rows', () => {
    const sections = normalizeFormSections(
      [
        {
          id: 'sec_main',
          label: 'Fields',
          rows: [{ id: 'row_a', columns: [{ fieldName: 'name', width: 100 }] }],
        },
      ],
      fields,
    )
    assert.deepEqual(sectionFieldNames(sections[0]!), ['name', 'email', 'message'])
  })
})

describe('form row layout mutations', () => {
  const base = normalizeFormSections(
    [{ id: 'sec_main', label: 'Fields', fieldNames: ['name', 'email', 'message'] }],
    fields,
  )

  it('addFieldToRow redistributes widths evenly', () => {
    const stripped = removeFieldFromSections(base, 'email')
    const joined = addFieldToRow(stripped, 'sec_main', stripped[0]!.rows[0]!.id, 'email')
    const cols = joined[0]!.rows[0]!.columns
    assert.equal(cols.length, 2)
    assert.equal(cols[0]!.width + cols[1]!.width, 100)
    assert.equal(cols[0]!.width, 50)
  })

  it('moveFieldInSections joins into target row', () => {
    const targetRow = base[0]!.rows[0]!.id
    const next = moveFieldInSections(base, 'email', {
      sectionId: 'sec_main',
      rowId: targetRow,
      index: 1,
    })
    assert.equal(next[0]!.rows.length, 2) // name+email row, message row
    assert.deepEqual(
      next[0]!.rows[0]!.columns.map((c) => c.fieldName),
      ['name', 'email'],
    )
  })

  it('splitFieldToOwnRow and mergeRows round-trip', () => {
    const joined = moveFieldInSections(base, 'email', {
      sectionId: 'sec_main',
      rowId: base[0]!.rows[0]!.id,
      index: 1,
    })
    const split = splitFieldToOwnRow(joined, 'sec_main', 'email')
    assert.ok(split[0]!.rows.every((r) => r.columns.length === 1))
    const a = split[0]!.rows[0]!.id
    const b = split[0]!.rows[1]!.id
    const merged = mergeRows(split, 'sec_main', a, b)
    assert.equal(merged[0]!.rows[0]!.columns.length, 2)
  })

  it('resizeRowColumns keeps pair sum', () => {
    const joined = moveFieldInSections(base, 'email', {
      sectionId: 'sec_main',
      rowId: base[0]!.rows[0]!.id,
      index: 1,
    })
    const rowId = joined[0]!.rows[0]!.id
    const resized = resizeRowColumns(joined, 'sec_main', rowId, 0, 70)
    const cols = resized[0]!.rows[0]!.columns
    assert.equal(cols[0]!.width, 70)
    assert.equal(cols[1]!.width, 30)
  })
})
