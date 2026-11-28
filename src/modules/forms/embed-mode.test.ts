import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { isFormBuilderEmbedMode } from './embed-mode'

describe('forms embed mode', () => {
  it('treats embed=1 as the flag that hides the admin shell', () => {
    assert.equal(isFormBuilderEmbedMode('1'), true)
    assert.equal(isFormBuilderEmbedMode(1), true)
  })

  it('keeps the normal builder when the embed flag is missing', () => {
    assert.equal(isFormBuilderEmbedMode(undefined), false)
    assert.equal(isFormBuilderEmbedMode(null), false)
    assert.equal(isFormBuilderEmbedMode(''), false)
    assert.equal(isFormBuilderEmbedMode('0'), false)
    assert.equal(isFormBuilderEmbedMode('true'), false)
  })
})
