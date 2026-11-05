import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  aggregateMediaKindCounts,
  classifyMediaMimeKind,
  emptyMediaKindCounts,
  isMediaDocMime,
} from './media-kind'

describe('classifyMediaMimeKind', () => {
  it('maps image / audio / video prefixes', () => {
    assert.equal(classifyMediaMimeKind('image/jpeg'), 'images')
    assert.equal(classifyMediaMimeKind('IMAGE/PNG'), 'images')
    assert.equal(classifyMediaMimeKind('audio/mpeg'), 'audio')
    assert.equal(classifyMediaMimeKind('video/mp4'), 'video')
  })

  it('maps document mimes (library + Office)', () => {
    assert.equal(classifyMediaMimeKind('application/pdf'), 'docs')
    assert.equal(classifyMediaMimeKind('text/plain'), 'docs')
    assert.equal(classifyMediaMimeKind('application/msword'), 'docs')
    assert.equal(
      classifyMediaMimeKind(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ),
      'docs',
    )
    assert.equal(classifyMediaMimeKind('application/vnd.ms-excel'), 'docs')
    assert.ok(isMediaDocMime('text/csv'))
  })

  it('falls through to other for unknown / empty', () => {
    assert.equal(classifyMediaMimeKind(''), 'other')
    assert.equal(classifyMediaMimeKind(null), 'other')
    assert.equal(classifyMediaMimeKind('application/octet-stream'), 'other')
    assert.equal(classifyMediaMimeKind('application/zip'), 'other')
  })
})

describe('aggregateMediaKindCounts', () => {
  it('sums mime groups into kind buckets', () => {
    const byKind = aggregateMediaKindCounts([
      { mimeType: 'image/webp', n: 3 },
      { mimeType: 'image/png', n: 2 },
      { mimeType: 'application/pdf', n: 4 },
      { mimeType: 'audio/mpeg', n: 1 },
      { mimeType: 'video/webm', n: 1 },
      { mimeType: 'application/octet-stream', n: 2 },
      { mimeType: null, n: 1 },
    ])
    assert.deepEqual(byKind, {
      images: 5,
      audio: 1,
      video: 1,
      docs: 4,
      other: 3,
    })
  })

  it('returns zeros for empty input', () => {
    assert.deepEqual(aggregateMediaKindCounts([]), emptyMediaKindCounts())
  })
})
