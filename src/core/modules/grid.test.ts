import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { LAYOUT_WIDTH_MIN, clampGridWidth, gridWidthPercent } from './grid'

describe('layout grid widths', () => {
  it('clamps to min/max integers', () => {
    assert.equal(clampGridWidth(3), LAYOUT_WIDTH_MIN)
    assert.equal(clampGridWidth(150), 100)
    assert.equal(clampGridWidth('42.6'), 43)
  })

  it('gridWidthPercent mirrors clamp', () => {
    assert.equal(gridWidthPercent(50), 50)
  })
})
