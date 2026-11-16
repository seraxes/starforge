import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { pageBodyToHtml } from './lexical-to-html'

describe('pageBodyToHtml', () => {
  it('leaves TipTap HTML alone', () => {
    const html = '<p>Hello <strong>there</strong></p>'
    assert.equal(pageBodyToHtml(html), html)
  })

  it('converts a Lexical paragraph and drops unsafe links', () => {
    const html = pageBodyToHtml({
      root: {
        type: 'root',
        children: [
          {
            type: 'heading',
            tag: 'h2',
            children: [{ type: 'text', text: 'Title', format: 0 }],
          },
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'Bold', format: 1 },
              {
                type: 'link',
                fields: { url: 'javascript:alert(1)' },
                children: [{ type: 'text', text: 'nope', format: 0 }],
              },
              {
                type: 'link',
                fields: { url: 'https://example.com' },
                children: [{ type: 'text', text: 'ok', format: 0 }],
              },
            ],
          },
        ],
      },
    })
    assert.match(html, /<h2>Title<\/h2>/)
    assert.match(html, /<strong>Bold<\/strong>/)
    assert.equal(html.includes('javascript:'), false)
    assert.match(html, /href="https:\/\/example.com"/)
  })

  it('converts JSON text the same way', () => {
    const json = JSON.stringify({
      root: {
        type: 'root',
        children: [
          {
            type: 'list',
            listType: 'bullet',
            children: [
              {
                type: 'listitem',
                children: [{ type: 'text', text: 'One <two>', format: 0 }],
              },
            ],
          },
        ],
      },
    })
    assert.equal(pageBodyToHtml(json), '<ul><li>One &lt;two&gt;</li></ul>')
  })
})
