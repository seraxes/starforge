/**
 * Smoke: Media Manager Phase 3 hygiene helpers + analysis confirm wiring.
 * Run: npm run verify:media-phase3
 */
import assert from 'node:assert/strict'

import { getMediaAnalysisPort } from '../src/core/media/analysis/index.ts'
import {
  bootMediaDerivativeSizes,
  mediaDerivativeSizeDrift,
  mediaSuggestionPatchIsEmpty,
  mediaTagWhereClause,
  mergeMediaAnalysisSuggestions,
  parseMediaBulkIds,
  parseMediaTagFilter,
  serializeMediaTagFilter,
} from '../src/core/media/library-query.ts'
import { DEFAULT_MEDIA_PIPELINE_RULES } from '../src/core/media/pipeline.ts'

assert.deepEqual(parseMediaTagFilter('3,7', 'and'), { ids: ['3', '7'], mode: 'and' })
assert.deepEqual(serializeMediaTagFilter({ ids: ['3', '7'], mode: 'and' }), {
  tag: '3,7',
  tagMode: 'and',
})
assert.ok(mediaTagWhereClause({ ids: ['3', '7'], mode: 'or' }))
assert.deepEqual(parseMediaBulkIds('10,11'), ['10', '11'])

const port = getMediaAnalysisPort()
const hooks = port.list().map((a) => a.id)
assert.ok(hooks.includes('noop'))
const results = await port.run({
  mediaId: '42',
  mime: 'image/webp',
  source: { url: '/media/example.webp' },
  hooks,
})
assert.equal(results.length, 1)
assert.equal(results[0]?.ok, true)

const withSuggestions = mergeMediaAnalysisSuggestions([
  ...results,
  {
    ok: true,
    kind: 'vision',
    suggestions: { alt: 'Demo alt', purpose: 'photo', tagIds: ['9'] },
  },
])
assert.equal(withSuggestions.alt, 'Demo alt')
assert.equal(mediaSuggestionPatchIsEmpty(withSuggestions), false)

const boot = bootMediaDerivativeSizes()
assert.deepEqual(boot, DEFAULT_MEDIA_PIPELINE_RULES.sizes)
assert.equal(mediaDerivativeSizeDrift(boot).length, 0)
assert.ok(
  mediaDerivativeSizeDrift({
    ...boot,
    thumbnail: boot.thumbnail + 80,
  }).length === 1,
)

console.log('verify-media-phase3: pass')
