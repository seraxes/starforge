import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { isEmailTemplateEmbedMode } from './embed-mode'

describe('email-manager embed mode', () => {
  it('treats embed=1 as the flag that hides the admin shell', () => {
    assert.equal(isEmailTemplateEmbedMode('1'), true)
    assert.equal(isEmailTemplateEmbedMode(1), true)
  })

  it('keeps the normal editor when the embed flag is missing', () => {
    assert.equal(isEmailTemplateEmbedMode(undefined), false)
    assert.equal(isEmailTemplateEmbedMode(null), false)
    assert.equal(isEmailTemplateEmbedMode(''), false)
    assert.equal(isEmailTemplateEmbedMode('0'), false)
    assert.equal(isEmailTemplateEmbedMode('true'), false)
  })
})
