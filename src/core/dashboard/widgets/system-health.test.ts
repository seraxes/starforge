import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  assembleSystemHealth,
  classifyRedisSelection,
  expectedMigrationFromJournal,
  formatMigrationGlance,
  rollupHealthLevel,
} from './system-health'

const migrationOk = {
  databaseUp: true,
  appliedCount: 2,
  expectedCount: 2,
  expectedTag: '0001_ready',
  relationMissing: false,
}

describe('system health glance', () => {
  it('classifyRedisSelection: skip, missing, configured', () => {
    assert.equal(classifyRedisSelection({}), 'skip')
    assert.equal(classifyRedisSelection({ STARFORGE_CONTENT_CACHE: 'next' }), 'skip')
    assert.equal(classifyRedisSelection({ STARFORGE_CONTENT_CACHE: 'redis' }), 'missing')
    assert.equal(
      classifyRedisSelection({ REDIS_URL: 'redis://127.0.0.1:6379' }),
      'configured',
    )
  })

  it('formatMigrationGlance: unavailable, untracked, behind, tag', () => {
    assert.deepEqual(
      formatMigrationGlance({ ...migrationOk, databaseUp: false }),
      { level: 'fail', value: 'Unavailable' },
    )
    assert.deepEqual(
      formatMigrationGlance({ ...migrationOk, relationMissing: true, appliedCount: null }),
      { level: 'warn', value: 'Untracked' },
    )
    assert.deepEqual(
      formatMigrationGlance({ ...migrationOk, appliedCount: null, relationMissing: false }),
      { level: 'warn', value: 'Unknown' },
    )
    assert.deepEqual(
      formatMigrationGlance({ ...migrationOk, appliedCount: 1, expectedCount: 4 }),
      { level: 'warn', value: 'Behind 1/4' },
    )
    assert.deepEqual(formatMigrationGlance(migrationOk), { level: 'ok', value: '0001_ready' })
  })

  it('assembleSystemHealth: fail wins over warn; redis skip is not a failure', () => {
    const glance = assembleSystemHealth({
      databaseUp: true,
      redis: 'skip',
      mediaReady: false,
      mediaLabel: 'Local disk',
      migration: migrationOk,
    })
    assert.equal(glance.level, 'fail')
    assert.equal(glance.levelLabel, 'Unhealthy')
    assert.equal(glance.rows.find((row) => row.key === 'redis')?.value, 'Not selected')
    assert.equal(glance.rows.find((row) => row.key === 'media')?.value, 'Not ready')
    assert.equal(glance.rows.some((row) => /redis:\/\//.test(row.value)), false)
  })

  it('assembleSystemHealth: healthy when probes are up', () => {
    const glance = assembleSystemHealth({
      databaseUp: true,
      redis: 'up',
      mediaReady: true,
      mediaLabel: 'S3 / Spaces',
      migration: migrationOk,
    })
    assert.equal(glance.level, 'ok')
    assert.equal(glance.rows.find((row) => row.key === 'media')?.value, 'S3 / Spaces')
    assert.equal(rollupHealthLevel(['ok', 'skip']), 'ok')
    assert.equal(rollupHealthLevel(['ok', 'warn']), 'warn')
  })

  it('expectedMigrationFromJournal reads the last tag', () => {
    assert.deepEqual(
      expectedMigrationFromJournal({
        entries: [{ tag: '0000_baseline' }, { tag: '0002_email' }],
      }),
      { count: 2, tag: '0002_email' },
    )
    assert.deepEqual(expectedMigrationFromJournal({}), { count: 0, tag: null })
  })
})
