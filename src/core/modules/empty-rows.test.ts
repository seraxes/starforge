import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  appendEmptyLayoutRow,
  ensureSectionEmptyRows,
  layoutRowIsEmpty,
  removeEmptyLayoutRow,
} from './empty-rows'
import type { LayoutSection } from './types'

describe('ensureSectionEmptyRows', () => {
  it('leaves an empty section empty (no auto trailing row)', () => {
    const section: LayoutSection = {
      id: 'sec-1',
      label: 'Main',
      order: 0,
      rows: [],
    }
    ensureSectionEmptyRows(section)
    assert.equal(section.rows.length, 0)
  })

  it('does not auto-add a trailing empty after a filled row', () => {
    const section: LayoutSection = {
      id: 'sec-1',
      label: 'Main',
      order: 0,
      rows: [
        {
          id: 'row-1',
          order: 0,
          slots: [{ id: 'slot-1', order: 0, moduleId: 'logo', width: 100 }],
        },
      ],
    }
    ensureSectionEmptyRows(section)
    assert.equal(section.rows.length, 1)
    assert.equal(section.rows[0]?.slots.length, 1)
  })

  it('collapses consecutive empty rows but keeps one', () => {
    const section: LayoutSection = {
      id: 'sec-1',
      label: 'Main',
      order: 0,
      rows: [
        { id: 'row-1', order: 0, slots: [{ id: 'slot-1', order: 0, moduleId: 'logo', width: 100 }] },
        { id: 'e1', order: 1, slots: [] },
        { id: 'e2', order: 2, slots: [] },
      ],
    }
    ensureSectionEmptyRows(section)
    assert.equal(section.rows.length, 2)
    assert.ok(layoutRowIsEmpty(section.rows[1]!))
  })
})

describe('append / remove empty layout rows', () => {
  it('appendEmptyLayoutRow adds one empty at the end', () => {
    const section: LayoutSection = {
      id: 'sec-1',
      label: 'Main',
      order: 0,
      rows: [
        { id: 'row-1', order: 0, slots: [{ id: 'slot-1', order: 0, moduleId: 'logo', width: 100 }] },
      ],
    }
    const empty = appendEmptyLayoutRow(section)
    assert.equal(section.rows.length, 2)
    assert.ok(layoutRowIsEmpty(empty))
    assert.equal(section.rows[1]?.id, empty.id)
  })

  it('appendEmptyLayoutRow is a no-op when trailing empty already exists', () => {
    const section: LayoutSection = {
      id: 'sec-1',
      label: 'Main',
      order: 0,
      rows: [{ id: 'e1', order: 0, slots: [] }],
    }
    const empty = appendEmptyLayoutRow(section)
    assert.equal(section.rows.length, 1)
    assert.equal(empty.id, 'e1')
  })

  it('removeEmptyLayoutRow deletes an empty row only', () => {
    const section: LayoutSection = {
      id: 'sec-1',
      label: 'Main',
      order: 0,
      rows: [
        { id: 'row-1', order: 0, slots: [{ id: 'slot-1', order: 0, moduleId: 'logo', width: 100 }] },
        { id: 'e1', order: 1, slots: [] },
      ],
    }
    assert.equal(removeEmptyLayoutRow(section, 'row-1'), false)
    assert.equal(removeEmptyLayoutRow(section, 'e1'), true)
    assert.equal(section.rows.length, 1)
    assert.equal(section.rows[0]?.id, 'row-1')
  })
})
