import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  LAYOUT_WIDTH_MIN,
  clampGridWidth,
  gridWidthPercent,
  mosaicParticleBarDropEdge,
} from './grid'

function fakeRect(width: number, height: number): DOMRect {
  return {
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: width,
    bottom: height,
    width,
    height,
    toJSON() {
      return this
    },
  }
}

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

describe('mosaicParticleBarDropEdge', () => {
  it('stacks on top/bottom bands of a wide short bar', () => {
    const rect = fakeRect(800, 48)
    assert.deepEqual(mosaicParticleBarDropEdge(400, 4, rect), {
      placeBeside: false,
      position: 'before',
    })
    assert.deepEqual(mosaicParticleBarDropEdge(400, 44, rect), {
      placeBeside: false,
      position: 'after',
    })
  })

  it('places beside in the middle band', () => {
    const rect = fakeRect(800, 48)
    assert.deepEqual(mosaicParticleBarDropEdge(100, 24, rect), {
      placeBeside: true,
      position: 'before',
    })
    assert.deepEqual(mosaicParticleBarDropEdge(700, 24, rect), {
      placeBeside: true,
      position: 'after',
    })
  })
})
