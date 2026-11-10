import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { assembleHostPulse, formatByteSize, formatNodeVersion, formatProcessUptime } from './host-pulse'

describe('host pulse', () => {
  it('formats process uptime', () => {
    assert.equal(formatProcessUptime(12), '12s')
    assert.equal(formatProcessUptime(90), '1m')
    assert.equal(formatProcessUptime(3_700), '1h 1m')
    assert.equal(formatProcessUptime(3_600), '1h')
    assert.equal(formatProcessUptime(90_000), '1d 1h')
    assert.equal(formatProcessUptime(86_400), '1d')
    assert.equal(formatProcessUptime(Number.NaN), '—')
  })

  it('formats byte sizes without pretending at traffic', () => {
    assert.equal(formatByteSize(0), '0 B')
    assert.equal(formatByteSize(1536), '1.5 KB')
    assert.equal(formatByteSize(10.5 * 1024 * 1024), '11 MB')
    assert.equal(formatByteSize(null), '—')
    assert.equal(formatByteSize(-1), '—')
  })

  it('assembleHostPulse keeps a missing library as a dash', () => {
    const pulse = assembleHostPulse({
      uptimeSec: 125,
      nodeVersion: 'v22.14.0',
      memoryBytes: 50 * 1024 * 1024,
      libraryBytes: null,
      databaseBytes: 2 * 1024 * 1024,
    })
    assert.equal(pulse.uptimeLabel, '2m')
    assert.equal(pulse.nodeLabel, 'v22.14.0')
    assert.equal(formatNodeVersion('22.14.0'), 'v22.14.0')
    assert.equal(pulse.memoryLabel, '50 MB')
    assert.equal(pulse.libraryLabel, '—')
    assert.equal(pulse.databaseLabel, '2.0 MB')
  })
})
