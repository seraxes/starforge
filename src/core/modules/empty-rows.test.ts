import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { ensureSectionEmptyRows } from './empty-rows'
import type { LayoutSection } from './types'

describe('ensureSectionEmptyRows', () => {
  it('adds a trailing empty row when the section is empty', () => {
    const section: LayoutSection = {
      id: 'sec-1',
      label: 'Main',
      order: 0,
      rows: [],
    }
    ensureSectionEmptyRows(section)
    assert.equal(section.rows.length, 1)
    assert.equal(section.rows[0]?.slots.length, 0)
  })

  it('keeps one empty trailing row after a filled row', () => {
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
    assert.equal(section.rows.length, 2)
    assert.equal(section.rows[1]?.slots.length, 0)
  })
})
