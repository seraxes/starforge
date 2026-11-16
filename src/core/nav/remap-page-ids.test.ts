import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { remapNavDocumentPageIds } from './remap-page-ids'

describe('remapNavDocumentPageIds', () => {
  const map = new Map<string, string>([['12', 'page-uuid']])

  it('rewrites numeric and numeric-string binds to the Starforge id', () => {
    const first = remapNavDocumentPageIds(
      {
        version: 1,
        items: [
          { id: 'a', linkType: 'page', pageId: 12, label: 'About' },
          { id: 'b', linkType: 'page', pageId: '12', label: 'Same' },
          { id: 'c', linkType: 'url', pageId: 12, url: '/x', label: 'Url' },
          { id: 'd', linkType: 'page', pageId: 'already-text', label: 'New' },
        ],
      },
      map,
    )
    assert.equal(first.changed, 2)
    const items = (first.next as { items: Array<{ pageId?: unknown }> }).items
    assert.equal(items[0]?.pageId, 'page-uuid')
    assert.equal(items[1]?.pageId, 'page-uuid')
    assert.equal(items[2]?.pageId, 12)
    assert.equal(items[3]?.pageId, 'already-text')

    const again = remapNavDocumentPageIds(first.next, map)
    assert.equal(again.changed, 0)
  })

  it('leaves an unknown Payload id untouched', () => {
    const result = remapNavDocumentPageIds(
      { version: 1, items: [{ linkType: 'page', pageId: 99 }] },
      map,
    )
    assert.equal(result.changed, 0)
  })
})
