import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { renderTransactionalMail } from './transactional'

describe('renderTransactionalMail', () => {
  it('keeps blank lines in text and links urls in html', () => {
    const rendered = renderTransactionalMail([
      'Hi Ada,',
      '',
      'Open this link:',
      'https://example.test/reset',
      '',
      '— Starforge',
    ])
    assert.match(rendered.text, /Hi Ada,\n\nOpen this link:/)
    assert.match(rendered.html, /<a href="https:\/\/example\.test\/reset">/)
    assert.doesNotMatch(rendered.html, /<p><\/p>/)
  })

  it('escapes html in body lines', () => {
    const rendered = renderTransactionalMail(['Hello <b>Ada</b>'])
    assert.match(rendered.html, /Hello &lt;b&gt;Ada&lt;\/b&gt;/)
  })
})
