import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  assertSafeMediaKey,
  derivativeStorageKey,
  joinStorageKey,
  mediaPublicFileUrl,
  originalKeyMatchesPrefix,
  storagePrefixFromChain,
} from './storage-key'

describe('media storage keys', () => {
  it('builds a category prefix from the slug chain', () => {
    assert.equal(storagePrefixFromChain(['logos', 'events']), 'logos/events')
    assert.equal(storagePrefixFromChain([]), 'general')
    assert.equal(storagePrefixFromChain(['ok', '../nope']), 'ok')
  })

  it('joins originals and hides derivatives under the category', () => {
    assert.equal(joinStorageKey('logos/events', 'photo.webp'), 'logos/events/photo.webp')
    assert.equal(
      derivativeStorageKey('logos/events', 'photo-thumbnail.webp'),
      'logos/events/_derivatives/photo-thumbnail.webp',
    )
    assert.equal(originalKeyMatchesPrefix('logos/events/photo.webp', 'logos/events'), true)
    assert.equal(
      originalKeyMatchesPrefix('logos/events/_derivatives/photo-thumbnail.webp', 'logos/events'),
      false,
    )
  })

  it('rejects traversal and keeps slashes in the public URL', () => {
    assert.throws(() => assertSafeMediaKey('logos/../../etc/passwd'))
    assert.throws(() => assertSafeMediaKey('/logos/photo.webp'))
    assert.throws(() => assertSafeMediaKey('logos\\photo.webp'))
    assert.equal(
      mediaPublicFileUrl('logos/events/my photo.webp'),
      '/api/media/file/logos/events/my%20photo.webp',
    )
  })
})