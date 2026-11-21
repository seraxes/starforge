import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  bodyWithoutUrl,
  firstHttpUrl,
  splitPollOptionInput,
  stageCanPost,
  stageNeedsReplace,
  stageReplacePrompt,
  stageSubmitFields,
} from './stage'

describe('social composer stage', () => {
  it('promotes a pasted URL into a link and keeps the caption (success path)', () => {
    const url = firstHttpUrl('Look at this https://example.com/a.')
    assert.equal(url, 'https://example.com/a')
    assert.equal(bodyWithoutUrl('Look at this https://example.com/a.', url!), 'Look at this .')
    assert.equal(stageNeedsReplace({ kind: 'media', mediaIds: ['m1'] }, 'link'), true)
    assert.equal(stageReplacePrompt('media', 'link'), 'This becomes a link. The photos come off.')
    const fields = stageSubmitFields({ kind: 'link', url: url! })
    assert.equal(fields.linkUrl, url)
    assert.deepEqual(fields.mediaIds, [])
    assert.equal(fields.pollOptions, '')
    assert.equal(fields.placeLabel, '')
    assert.equal(stageCanPost({ body: 'Look', block: { kind: 'link', url: url! }, allowText: true }), true)
  })

  it('refuses an empty stage and a one-option vote (failure path)', () => {
    assert.equal(stageCanPost({ body: '   ', block: null, allowText: true }), false)
    assert.equal(
      stageCanPost({ body: 'Words only', block: null, allowText: false }),
      false,
    )
    assert.equal(
      stageCanPost({
        body: 'Pick one',
        block: { kind: 'poll', options: ['Only'] },
        allowText: true,
      }),
      false,
    )
    assert.equal(stageNeedsReplace({ kind: 'poll', options: [''] }, 'place'), false)
    const fields = stageSubmitFields({ kind: 'poll', options: ['Pizza', 'Fish, chips'] })
    assert.equal(fields.pollOptions, 'Pizza\nFish, chips')
    assert.equal(fields.linkUrl, '')
    assert.deepEqual(splitPollOptionInput(fields.pollOptions), ['Pizza', 'Fish, chips'])
    assert.deepEqual(splitPollOptionInput('Pizza, Sushi'), ['Pizza', 'Sushi'])
  })
})