import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  BUILTIN_EMAIL_TRIGGERS,
  getEmailTrigger,
  isKnownEmailTriggerKey,
  listEmailTriggers,
} from './triggers'

describe('email triggers registry', () => {
  it('includes Forms submitted trigger', () => {
    const t = getEmailTrigger('product:forms/submitted')
    assert.ok(t)
    assert.equal(t.moduleCategory, 'forms')
    assert.ok(t.payloadFields.includes('adminEmails'))
  })

  it('filters by module category', () => {
    const auth = listEmailTriggers({ moduleCategory: 'auth' })
    assert.ok(auth.length >= 1)
    assert.ok(auth.every((t) => t.moduleCategory === 'auth'))
  })

  it('knows built-in keys', () => {
    assert.equal(isKnownEmailTriggerKey('system:test'), true)
    assert.equal(isKnownEmailTriggerKey('nope'), false)
    assert.ok(BUILTIN_EMAIL_TRIGGERS.length >= 4)
  })
})
