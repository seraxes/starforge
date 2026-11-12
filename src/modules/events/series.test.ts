import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  expandSeriesStarts,
  parseEventSeriesPattern,
  parseSeriesPatternFromForm,
} from './series'

describe('expandSeriesStarts', () => {
  it('expands weekly Fridays for a count', () => {
    // Friday 2026-11-13 local evening
    const first = new Date(2026, 10, 13, 18, 0, 0, 0)
    assert.equal(first.getDay(), 5)
    const starts = expandSeriesStarts(first, {
      frequency: 'weekly',
      interval: 1,
      weekdays: [5],
      endMode: 'count',
      count: 4,
      until: null,
    })
    assert.equal(starts.length, 4)
    assert.equal(starts[0].getTime(), first.getTime())
    assert.equal(starts[1].getDate(), 20)
    assert.equal(starts[3].getDate(), 4) // Dec 4
    assert.equal(starts[3].getMonth(), 11)
  })

  it('expands daily with interval 2 until a date', () => {
    const first = new Date(2026, 0, 1, 10, 0, 0, 0)
    const starts = expandSeriesStarts(first, {
      frequency: 'daily',
      interval: 2,
      weekdays: [],
      endMode: 'until',
      count: null,
      until: '2026-01-07',
    })
    assert.deepEqual(
      starts.map((d) => d.getDate()),
      [1, 3, 5, 7],
    )
  })

  it('expands monthly clamping short months', () => {
    const first = new Date(2026, 0, 31, 12, 0, 0, 0)
    const starts = expandSeriesStarts(first, {
      frequency: 'monthly',
      interval: 1,
      weekdays: [],
      endMode: 'count',
      count: 3,
      until: null,
    })
    assert.equal(starts.length, 3)
    assert.equal(starts[1].getMonth(), 1)
    assert.equal(starts[1].getDate(), 28)
    assert.equal(starts[2].getMonth(), 2)
    assert.equal(starts[2].getDate(), 31)
  })
})

describe('parseSeriesPatternFromForm', () => {
  it('returns null when recurring is off', () => {
    const fd = new FormData()
    fd.set('recurringFrequency', 'weekly')
    assert.equal(parseSeriesPatternFromForm(fd), null)
  })

  it('parses weekly create fields', () => {
    const fd = new FormData()
    fd.set('recurringEnabled', '1')
    fd.set('recurringFrequency', 'weekly')
    fd.set('recurringInterval', '1')
    fd.append('recurringWeekday', '5')
    fd.set('recurringEndMode', 'count')
    fd.set('recurringCount', '8')
    const pattern = parseSeriesPatternFromForm(fd)
    assert.ok(pattern)
    assert.equal(pattern.frequency, 'weekly')
    assert.deepEqual(pattern.weekdays, [5])
    assert.equal(pattern.count, 8)
  })
})

describe('parseEventSeriesPattern', () => {
  it('rejects until mode without a date', () => {
    assert.equal(
      parseEventSeriesPattern({
        frequency: 'daily',
        interval: 1,
        endMode: 'until',
      }),
      null,
    )
  })
})
