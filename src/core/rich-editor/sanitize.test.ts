import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { sanitizeRichHtml } from './sanitize'

describe('sanitizeRichHtml', () => {
  it('returns empty for blank input', () => {
    assert.equal(sanitizeRichHtml(''), '')
    assert.equal(sanitizeRichHtml('   '), '')
    assert.equal(sanitizeRichHtml(null), '')
  })

  it('keeps headings paragraphs and links', () => {
    const out = sanitizeRichHtml(
      '<h2>Game</h2><p>Hello <a href="https://example.com">link</a></p>',
    )
    assert.match(out, /<h2>/)
    assert.match(out, /<a href="https:\/\/example.com"/)
  })

  it('strips script and event handlers', () => {
    const out = sanitizeRichHtml(
      '<p onclick="alert(1)">x</p><script>alert(2)</script><img src="/a.jpg" onerror="alert(3)" data-media-id="12" />',
    )
    assert.doesNotMatch(out, /script/i)
    assert.doesNotMatch(out, /onclick/i)
    assert.doesNotMatch(out, /onerror/i)
    assert.match(out, /data-media-id="12"/)
  })

  it('keeps data-sf gallery markers', () => {
    const out = sanitizeRichHtml(
      '<figure data-sf="gallery" data-media-ids="1,2"><img src="/x.jpg" alt="" /></figure>',
    )
    assert.match(out, /data-sf="gallery"/)
    assert.match(out, /data-media-ids="1,2"/)
  })

  it('keeps media video placeholder attrs', () => {
    const out = sanitizeRichHtml(
      '<div data-sf="video" data-provider="media" data-media-id="99" data-src="/media/clip.mp4"></div>',
    )
    assert.match(out, /data-provider="media"/)
    assert.match(out, /data-media-id="99"/)
    assert.match(out, /data-src="\/media\/clip\.mp4"/)
  })
})
