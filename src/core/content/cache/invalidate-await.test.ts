import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { ContentCacheGetOptions, PublishedContentCache } from './types'

/**
 * Contract: invalidateTags may be sync or async; callers always await.
 * Redis adapter must return a Promise (not fire-and-forget void).
 */
describe('PublishedContentCache.invalidateTags await contract', () => {
  it('awaiting a sync void invalidate is safe', async () => {
    let called = false
    const cache: PublishedContentCache = {
      getCached<T>(_o: ContentCacheGetOptions, loader: () => Promise<T>) {
        return loader()
      },
      invalidateTags() {
        called = true
      },
    }
    await cache.invalidateTags(['sf:test'])
    assert.equal(called, true)
  })

  it('awaiting an async invalidate waits for completion', async () => {
    let finished = false
    const cache: PublishedContentCache = {
      getCached<T>(_o: ContentCacheGetOptions, loader: () => Promise<T>) {
        return loader()
      },
      async invalidateTags() {
        await new Promise((r) => setTimeout(r, 5))
        finished = true
      },
    }
    const pending = cache.invalidateTags(['sf:test'])
    assert.equal(finished, false)
    await pending
    assert.equal(finished, true)
  })
})
