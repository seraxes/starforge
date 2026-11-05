import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  formatContentCacheGlance,
  formatDashboardRefreshGlance,
  formatFormRateMaxGlance,
  formatFormRateWindowGlance,
} from './performance-glance'

describe('performance glance formatters', () => {
  it('formats refresh / rate knobs', () => {
    assert.equal(formatDashboardRefreshGlance(60), '60s')
    assert.equal(formatFormRateWindowGlance(90), '90s')
    assert.equal(formatFormRateMaxGlance(8), '8')
  })

  it('formatContentCacheGlance: Off / Next / Redis', () => {
    assert.equal(formatContentCacheGlance(false, 'redis'), 'Off')
    assert.equal(formatContentCacheGlance(true, undefined), 'Next')
    assert.equal(formatContentCacheGlance(true, ''), 'Next')
    assert.equal(formatContentCacheGlance(true, 'redis'), 'Redis')
    assert.equal(formatContentCacheGlance(true, 'REDIS'), 'Redis')
  })
})
