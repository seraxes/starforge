import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { clearMemoryRateLimitBuckets, resetRateLimiterForTests } from '@/core/security/rate-limit'

import {
  checkSocialWriteRateLimit,
  clearSocialWriteRateLimitBuckets,
} from './rate-limit'

describe('social write rate limit', () => {
  it('allows a call under the limit and refuses the next past the limit without writing', async () => {
    clearSocialWriteRateLimitBuckets()
    clearMemoryRateLimitBuckets()
    resetRateLimiterForTests()

    const requestHeaders = new Headers()
    let writes = 0

    async function attemptWrite(userId: string): Promise<{ ok: true } | { ok: false }> {
      const limited = await checkSocialWriteRateLimit(userId, requestHeaders, {
        limit: 1,
        windowSec: 60,
      })
      if (!limited.ok) return { ok: false }
      writes += 1
      return { ok: true }
    }

    const first = await attemptWrite('member-a')
    assert.equal(first.ok, true)
    assert.equal(writes, 1)

    const second = await attemptWrite('member-a')
    assert.equal(second.ok, false)
    assert.equal(writes, 1)

    clearSocialWriteRateLimitBuckets()
    resetRateLimiterForTests()
  })
})
