import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { parseVideoInput, videoEmbedSrc } from './nodes/video'

describe('parseVideoInput', () => {
  it('parses YouTube watch URL', () => {
    const r = parseVideoInput('https://www.youtube.com/watch?v=dQw4w9wgXcQ')
    assert.deepEqual(r, { provider: 'youtube', videoId: 'dQw4w9wgXcQ' })
  })

  it('parses youtu.be short URL', () => {
    const r = parseVideoInput('https://youtu.be/dQw4w9wgXcQ')
    assert.deepEqual(r, { provider: 'youtube', videoId: 'dQw4w9wgXcQ' })
  })

  it('parses Vimeo URL', () => {
    const r = parseVideoInput('https://vimeo.com/123456789')
    assert.deepEqual(r, { provider: 'vimeo', videoId: '123456789' })
  })
})

describe('videoEmbedSrc', () => {
  it('builds nocookie YouTube embed', () => {
    assert.equal(
      videoEmbedSrc('youtube', 'abc'),
      'https://www.youtube-nocookie.com/embed/abc',
    )
  })
})
