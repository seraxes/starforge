import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  computeImageFrameLayout,
  normalizeImageFrame,
  panImageFrame,
} from './image-frame'

describe('image-frame layout', () => {
  it('at x/y=0 pins the top-left of a tall image', () => {
    // 1000x2000 image in 200x200 frame → cover scale 0.2 → 200x400, overflowY=200
    const layout = computeImageFrameLayout({
      frameW: 200,
      frameH: 200,
      natW: 1000,
      natH: 2000,
      frame: { x: 0, y: 0, zoom: 1 },
    })
    assert.ok(layout)
    assert.equal(layout.top, 0)
    assert.equal(layout.left, 0)
    assert.equal(layout.height, 400)
    assert.equal(layout.overflowY, 200)
  })

  it('at y=100 shows the bottom of a tall image', () => {
    const layout = computeImageFrameLayout({
      frameW: 200,
      frameH: 200,
      natW: 1000,
      natH: 2000,
      frame: { x: 50, y: 100, zoom: 1 },
    })
    assert.ok(layout)
    assert.equal(layout.top, -200)
  })

  it('zoom increases overflow so more pan range exists', () => {
    const z1 = computeImageFrameLayout({
      frameW: 200,
      frameH: 200,
      natW: 1000,
      natH: 2000,
      frame: { x: 0, y: 0, zoom: 1 },
    })
    const z2 = computeImageFrameLayout({
      frameW: 200,
      frameH: 200,
      natW: 1000,
      natH: 2000,
      frame: { x: 0, y: 0, zoom: 2 },
    })
    assert.ok(z1 && z2)
    assert.ok(z2.overflowY > z1.overflowY)
    assert.equal(z2.top, 0)
  })

  it('dragging down decreases y (reveals the top)', () => {
    const next = panImageFrame(
      { x: 50, y: 50, zoom: 1 },
      { dx: 0, dy: 100 },
      { overflowX: 0, overflowY: 200 },
    )
    assert.equal(next.y, 0)
    assert.equal(normalizeImageFrame({ x: 0, y: -10, zoom: 1 }).y, 0)
  })
})
