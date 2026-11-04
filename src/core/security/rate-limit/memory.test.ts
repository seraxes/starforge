import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  clearMemoryRateLimitBuckets,
  createMemoryRateLimiter,
  getRateLimiter,
  resetRateLimiterForTests,
} from './index'

describe('memory RateLimiter', () => {
  it('allows up to limit then rejects within the window', async () => {
    clearMemoryRateLimitBuckets()
    const limiter = createMemoryRateLimiter()
    const key = `test:${Date.now()}`

    assert.equal((await limiter.consume(key, { limit: 2, windowSec: 60 })).ok, true)
    assert.equal((await limiter.consume(key, { limit: 2, windowSec: 60 })).ok, true)
    const blocked = await limiter.consume(key, { limit: 2, windowSec: 60 })
    assert.equal(blocked.ok, false)
    assert.ok((blocked.retryAfterSec ?? 0) >= 1)
  })

  it('getRateLimiter uses memory when REDIS_URL is unset', async () => {
    const saved = process.env.REDIS_URL
    try {
      delete process.env.REDIS_URL
      resetRateLimiterForTests()
      const a = getRateLimiter()
      const b = getRateLimiter()
      assert.equal(a, b)
      assert.equal((await a.consume('singleton-key', { limit: 1, windowSec: 60 })).ok, true)
      assert.equal((await a.consume('singleton-key', { limit: 1, windowSec: 60 })).ok, false)
    } finally {
      if (saved === undefined) delete process.env.REDIS_URL
      else process.env.REDIS_URL = saved
      resetRateLimiterForTests()
    }
  })
})
