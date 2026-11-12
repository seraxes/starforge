import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  applyBroadcastRecipientCap,
  broadcastSliceCount,
  clampBroadcastBatchSize,
  clampBroadcastGapMinutes,
  normalizeBroadcastRecipients,
  normalizeEmailManagerModuleSettings,
} from './broadcast'
import {
  DEFAULT_EMAIL_MANAGER_MODULE_SETTINGS,
  EMAIL_BROADCAST_RECIPIENT_CAP,
} from './types'

describe('normalizeBroadcastRecipients', () => {
  it('dedupes and lowercases emails; first payload wins', () => {
    const rows = normalizeBroadcastRecipients([
      { email: 'A@B.C', payload: { name: 'first' } },
      { email: 'a@b.c', payload: { name: 'second' } },
      { email: 'd@e.f', payload: { name: 'other' } },
      { email: 'not-valid' },
    ])
    assert.deepEqual(
      rows.map((r) => r.email),
      ['a@b.c', 'd@e.f'],
    )
    assert.equal(rows[0]?.payload.name, 'first')
  })
})

describe('applyBroadcastRecipientCap', () => {
  it('truncates at the hard cap', () => {
    const many = Array.from({ length: EMAIL_BROADCAST_RECIPIENT_CAP + 5 }, (_, i) => ({
      email: `u${i}@x.y`,
      payload: {},
    }))
    const capped = applyBroadcastRecipientCap(many)
    assert.equal(capped.recipients.length, EMAIL_BROADCAST_RECIPIENT_CAP)
    assert.equal(capped.truncated, true)
  })

  it('leaves small lists alone', () => {
    const capped = applyBroadcastRecipientCap([
      { email: 'a@b.c', payload: {} },
      { email: 'd@e.f', payload: {} },
    ])
    assert.equal(capped.recipients.length, 2)
    assert.equal(capped.truncated, false)
  })
})

describe('broadcastSliceCount', () => {
  it('splits 45 people into three slices of 20', () => {
    assert.equal(broadcastSliceCount(45, 20), 3)
  })

  it('returns 0 for empty', () => {
    assert.equal(broadcastSliceCount(0, 20), 0)
  })

  it('returns 1 when total fits one batch', () => {
    assert.equal(broadcastSliceCount(20, 20), 1)
  })
})

describe('pace clamps', () => {
  it('clamps batch and gap to allowed ranges', () => {
    assert.equal(clampBroadcastBatchSize(0), 1)
    assert.equal(clampBroadcastBatchSize(99), 50)
    assert.equal(clampBroadcastGapMinutes(0), 1)
    assert.equal(clampBroadcastGapMinutes(999), 120)
  })

  it('normalizes module settings with defaults', () => {
    assert.deepEqual(normalizeEmailManagerModuleSettings({}), DEFAULT_EMAIL_MANAGER_MODULE_SETTINGS)
    assert.deepEqual(normalizeEmailManagerModuleSettings({ broadcastBatchSize: 25, broadcastGapMinutes: 15 }), {
      broadcastBatchSize: 25,
      broadcastGapMinutes: 15,
    })
  })
})
