import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { nextEmptyRowId } from '../../../../core/modules/empty-row-id'
import { insertIndex, moveIdInOrder } from './section-row-drag'

describe('nextEmptyRowId', () => {
  it('uses one stable id, then a numeric suffix', () => {
    const used = new Set<string>()
    const first = nextEmptyRowId('sec', used)
    assert.equal(first, 'sec__empty-row')
    used.add(first)
    assert.equal(nextEmptyRowId('sec', used), 'sec__empty-row-2')
    used.add('sec__empty-row-2')
    assert.equal(nextEmptyRowId('sec', used), 'sec__empty-row-3')
  })
})

describe('canvas drag order', () => {
  const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

  it('moves an item using the pre-removal insert index', () => {
    assert.deepEqual(
      moveIdInOrder(rows, 'a', 2, (row) => row.id).map((row) => row.id),
      ['b', 'a', 'c'],
    )
    assert.deepEqual(
      moveIdInOrder(rows, 'c', 0, (row) => row.id).map((row) => row.id),
      ['c', 'a', 'b'],
    )
  })

  it('treats a drop on the item’s own edges as a no-op', () => {
    assert.equal(insertIndex(0, 0, 'before'), null)
    assert.equal(insertIndex(0, 0, 'after'), null)
    assert.equal(insertIndex(1, 0, 'after'), null)
    assert.equal(insertIndex(1, 2, 'before'), null)
  })

  it('returns an insert index for a foreign item', () => {
    assert.equal(insertIndex(-1, 0, 'before'), 0)
    assert.equal(insertIndex(-1, 1, 'after'), 2)
  })
})
