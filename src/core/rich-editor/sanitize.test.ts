import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { sanitizeEmailHtml, sanitizeRichHtml } from './sanitize'

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

describe('sanitizeEmailHtml', () => {
  it('returns empty for blank input', () => {
    assert.equal(sanitizeEmailHtml(''), '')
    assert.equal(sanitizeEmailHtml('   '), '')
    assert.equal(sanitizeEmailHtml(null), '')
  })

  it('keeps email-safe tags and strips web-only blocks', () => {
    const out = sanitizeEmailHtml(
      '<h2>Hello</h2><p>Hi <strong>there</strong></p><div data-sf="video" data-provider="youtube" data-id="x"></div><figure data-sf="gallery"><img src="https://cdn.example/a.jpg" alt="a" /></figure><p class="x" style="color:red; text-align: center">C</p>',
    )
    assert.match(out, /<h2>/)
    assert.match(out, /<strong>/)
    assert.doesNotMatch(out, /data-sf/)
    assert.doesNotMatch(out, /<div/i)
    assert.doesNotMatch(out, /<figure/i)
    assert.doesNotMatch(out, /class=/)
    assert.doesNotMatch(out, /color:/)
    assert.match(out, /text-align:\s*center/)
  })

  it('strips scripts javascript urls and keeps merge tokens', () => {
    const out = sanitizeEmailHtml(
      '<p><a href="javascript:alert(1)">bad</a><a href="{{ticketUrl}}">ok</a></p><img src="data:text/html;base64,xx" alt="" /><img src="{{logoUrl}}" alt="logo" />',
    )
    assert.doesNotMatch(out, /javascript:/i)
    assert.doesNotMatch(out, /data:text/i)
    assert.match(out, /href="\{\{ticketUrl\}\}"/)
    assert.match(out, /src="\{\{logoUrl\}\}"/)
  })

  it('rewrites relative urls when baseUrl is set', () => {
    const out = sanitizeEmailHtml(
      '<p><a href="/account">Account</a></p><img src="/media/logo.png" alt="Logo" />',
      { baseUrl: 'https://starforge.example' },
    )
    assert.match(out, /href="https:\/\/starforge\.example\/account"/)
    assert.match(out, /src="https:\/\/starforge\.example\/media\/logo\.png"/)
  })
})
