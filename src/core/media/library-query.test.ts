import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  bootMediaDerivativeSizes,
  mediaDerivativeSizeDrift,
  mediaSuggestionPatchIsEmpty,
  mediaTagWhereClause,
  mergeMediaAnalysisSuggestions,
  normalizeMediaPurposeFilter,
  parseMediaBulkIds,
  parseMediaTagFilter,
  serializeMediaTagFilter,
} from './library-query'
import { DEFAULT_MEDIA_PIPELINE_RULES } from './pipeline'

describe('media library query helpers (Phase 3)', () => {
  it('parses single and multi tag filters with AND/OR', () => {
    assert.deepEqual(parseMediaTagFilter(undefined), { ids: [], mode: 'or' })
    assert.deepEqual(parseMediaTagFilter('all'), { ids: [], mode: 'or' })
    assert.deepEqual(parseMediaTagFilter('12'), { ids: ['12'], mode: 'or' })
    assert.deepEqual(parseMediaTagFilter('12,34', 'and'), {
      ids: ['12', '34'],
      mode: 'and',
    })
    assert.deepEqual(parseMediaTagFilter('12,12,34'), {
      ids: ['12', '34'],
      mode: 'or',
    })
  })

  it('serializes tag filters for URL sync', () => {
    assert.deepEqual(serializeMediaTagFilter({ ids: [], mode: 'or' }), {})
    assert.deepEqual(serializeMediaTagFilter({ ids: ['9'], mode: 'and' }), {
      tag: '9',
    })
    assert.deepEqual(serializeMediaTagFilter({ ids: ['1', '2'], mode: 'or' }), {
      tag: '1,2',
    })
    assert.deepEqual(serializeMediaTagFilter({ ids: ['1', '2'], mode: 'and' }), {
      tag: '1,2',
      tagMode: 'and',
    })
  })

  it('builds Payload where fragments for tags', () => {
    assert.equal(mediaTagWhereClause({ ids: [], mode: 'or' }), null)
    assert.deepEqual(mediaTagWhereClause({ ids: ['5'], mode: 'or' }), {
      tags: { equals: 5 },
    })
    assert.deepEqual(mediaTagWhereClause({ ids: ['1', '2'], mode: 'or' }), {
      or: [{ tags: { equals: 1 } }, { tags: { equals: 2 } }],
    })
    assert.deepEqual(mediaTagWhereClause({ ids: ['1', '2'], mode: 'and' }), {
      and: [{ tags: { equals: 1 } }, { tags: { equals: 2 } }],
    })
  })

  it('normalizes purpose filter and bulk ids', () => {
    assert.equal(normalizeMediaPurposeFilter(''), 'all')
    assert.equal(normalizeMediaPurposeFilter('logo'), 'logo')
    assert.equal(normalizeMediaPurposeFilter('nope'), 'all')
    assert.deepEqual(parseMediaBulkIds('1, 2;3 3'), ['1', '2', '3'])
    assert.deepEqual(parseMediaBulkIds(['4', '5,6']), ['4', '5', '6'])
  })

  it('merges analysis suggestions without silent empty patch', () => {
    const merged = mergeMediaAnalysisSuggestions([
      {
        ok: true,
        kind: 'vision',
        suggestions: { alt: 'A sign', purpose: 'photo', tagIds: ['1'] },
      },
      {
        ok: true,
        kind: 'ocr',
        suggestions: { alt: 'ignored later', tagIds: ['1', '2'], purpose: 'logo' },
      },
    ])
    assert.equal(merged.alt, 'A sign')
    assert.equal(merged.purpose, 'photo')
    assert.deepEqual(merged.tagIds, ['1', '2'])
    assert.equal(mediaSuggestionPatchIsEmpty({}), true)
    assert.equal(mediaSuggestionPatchIsEmpty(merged), false)
  })

  it('detects derivative size drift vs boot Payload imageSizes', () => {
    const boot = bootMediaDerivativeSizes()
    assert.deepEqual(boot, DEFAULT_MEDIA_PIPELINE_RULES.sizes)
    assert.deepEqual(mediaDerivativeSizeDrift(boot), [])
    const drifted = mediaDerivativeSizeDrift({
      thumbnail: 400,
      card: boot.card,
      large: 2048,
    })
    assert.equal(drifted.length, 2)
    assert.ok(drifted.some((d) => d.key === 'thumbnail' && d.saved === 400))
    assert.ok(drifted.some((d) => d.key === 'large' && d.boot === boot.large))
  })
})
