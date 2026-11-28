/**
 * Guard tests for db:core:push (slice L2).
 * Does not run drizzle-kit push.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { evaluateDbCorePushGuard } from './guard-db-core-push'

const LOCAL_URL = 'postgresql://starforge:starforge@localhost:5432/starforge'
const LOOPBACK_URL = 'postgresql://starforge:starforge@127.0.0.1:5432/starforge'
const REMOTE_URL = 'postgresql://starforge:starforge@db.example.com:5432/starforge'

describe('db:core:push guard', () => {
  it('failure: refuses without STARFORGE_ALLOW_PUSH', () => {
    const decision = evaluateDbCorePushGuard({ DATABASE_URL: LOCAL_URL })
    assert.equal(decision.allowed, false)
    if (!decision.allowed) {
      assert.match(decision.reason, /STARFORGE_ALLOW_PUSH/)
    }
  })

  it('failure: refuses when DATABASE_URL is not localhost', () => {
    const decision = evaluateDbCorePushGuard({
      STARFORGE_ALLOW_PUSH: '1',
      DATABASE_URL: REMOTE_URL,
    })
    assert.equal(decision.allowed, false)
    if (!decision.allowed) {
      assert.match(decision.reason, /localhost/)
    }
  })

  it('success: flag set and localhost URL is allowed', () => {
    const decision = evaluateDbCorePushGuard({
      STARFORGE_ALLOW_PUSH: '1',
      DATABASE_URL: LOCAL_URL,
    })
    assert.deepEqual(decision, { allowed: true })
  })

  it('success: 127.0.0.1 counts as localhost', () => {
    const decision = evaluateDbCorePushGuard({
      STARFORGE_ALLOW_PUSH: '1',
      DATABASE_URL: LOOPBACK_URL,
    })
    assert.deepEqual(decision, { allowed: true })
  })
})
