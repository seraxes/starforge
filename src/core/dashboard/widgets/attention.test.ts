import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildCoreAttentionItems,
  safeEnvAttentionLabel,
  visibleEnvWarnings,
} from './attention'

describe('needs-attention rail', () => {
  it('seeds offline, mailer off, and health, critical first', () => {
    const items = buildCoreAttentionItems({
      siteOffline: true,
      mailerEnabled: false,
      healthLevel: 'fail',
      envWarnings: null,
    })
    assert.deepEqual(
      items.map((item) => item.id),
      ['health.fail', 'site.offline', 'mailer.off'],
    )
    assert.equal(items[0]?.severity, 'critical')
    assert.equal(items[0]?.href, '/admin/site-chrome/environment')
    assert.equal(items[1]?.href, '/admin/site-chrome')
  })

  it('omits env warnings unless the caller passes them', () => {
    const hidden = buildCoreAttentionItems({
      siteOffline: false,
      mailerEnabled: true,
      healthLevel: 'ok',
      envWarnings: null,
    })
    assert.deepEqual(hidden, [])

    assert.equal(visibleEnvWarnings(false, [{ key: 'SMTP_PORT', message: 'x' }]), null)
    const shown = visibleEnvWarnings(true, [{ key: 'SMTP_PORT', message: 'SMTP_PORT is empty.' }])
    assert.equal(shown?.length, 1)
  })

  it('caps env warnings and strips secret-looking messages', () => {
    const warnings = [
      { key: 'A', message: 'A is missing.' },
      { key: 'REDIS_URL', message: 'redis://user:secret@127.0.0.1:6379' },
      { key: 'C', message: 'C is missing.' },
      { key: 'D', message: 'D is missing.' },
      { key: 'E', message: 'E is missing.' },
    ]
    assert.equal(
      safeEnvAttentionLabel({ key: 'REDIS_URL', message: warnings[1]!.message }),
      'REDIS_URL needs a look',
    )
    const items = buildCoreAttentionItems({
      siteOffline: false,
      mailerEnabled: true,
      healthLevel: 'warn',
      envWarnings: warnings,
    })
    assert.equal(items[0]?.id, 'health.warn')
    assert.equal(items.filter((item) => item.id.startsWith('env.')).length, 5)
    assert.equal(items.find((item) => item.id === 'env.more')?.label, '1 more environment warning')
    assert.equal(items.find((item) => item.id === 'env.REDIS_URL')?.label, 'REDIS_URL needs a look')
    assert.equal(items.find((item) => item.id === 'env.E'), undefined)
  })

  it('does not invent offline or mailer rows when Chrome was unread', () => {
    const items = buildCoreAttentionItems({
      siteOffline: null,
      mailerEnabled: null,
      healthLevel: 'ok',
      envWarnings: [],
    })
    assert.deepEqual(items, [])
  })
})
