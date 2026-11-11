import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  applyBucketCounts,
  areaPath,
  donutSlices,
  formatSignedPercent,
  linePath,
  monthSeriesBuckets,
  percentDelta,
  plotPoints,
} from './series'

describe('dashboard chart series', () => {
  it('builds 12 UTC month buckets ending on the current month', () => {
    const buckets = monthSeriesBuckets(new Date(Date.UTC(2026, 10, 11)), 12)
    assert.equal(buckets.length, 12)
    assert.equal(buckets[0]?.key, '2025-12')
    assert.equal(buckets[0]?.label, 'Dec')
    assert.equal(buckets[11]?.key, '2026-11')
    assert.equal(buckets[11]?.label, 'Nov')
    assert.equal(buckets[11]?.value, 0)
  })

  it('fills only matching bucket keys', () => {
    const buckets = monthSeriesBuckets(new Date(Date.UTC(2026, 10, 11)), 3)
    const filled = applyBucketCounts(buckets, [
      { key: '2026-11', value: 4 },
      { key: '1999-01', value: 9 },
    ])
    assert.deepEqual(
      filled.map((point) => point.value),
      [0, 0, 4],
    )
  })

  it('omits a percent when the prior window is empty', () => {
    assert.equal(percentDelta(3, 0), null)
    assert.equal(percentDelta(12, 10), 20)
    assert.equal(percentDelta(8, 10), -20)
    assert.equal(formatSignedPercent(12.5), '+12.5%')
    assert.equal(formatSignedPercent(-2), '-2%')
  })

  it('draws a line and a closed area from the baseline', () => {
    const points = plotPoints([0, 2], 10, 10, 0)
    assert.equal(points[0]?.y, 10)
    assert.equal(points[1]?.y, 0)
    const line = linePath(points)
    assert.match(line, /^M/)
    assert.match(line, /L/)
    assert.match(areaPath(points, 10), /Z$/)
  })

  it('splits a donut into fractions of the total', () => {
    const slices = donutSlices([1, 1, 2], 0)
    assert.equal(slices.length, 3)
    assert.equal(slices[0]?.frac, 0.25)
    assert.equal(slices[2]?.offset, 0.5)
    assert.equal(donutSlices([0, 0]).length, 0)
  })
})
