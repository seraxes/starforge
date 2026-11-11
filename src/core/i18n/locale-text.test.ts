import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { pickLocaleText } from './locale-text'

describe('pickLocaleText', () => {
  const map = { en: 'Events', hu: 'Események' }

  it('uses the request locale', () => {
    assert.equal(pickLocaleText(map, 'Events', 'hu', 'en', true), 'Események')
  })

  it('falls back to the default locale when the translation is empty', () => {
    assert.equal(pickLocaleText({ en: 'Events' }, 'Events', 'hu', 'en', true), 'Events')
  })

  it('uses the legacy string when fallback is off and the locale is missing', () => {
    assert.equal(pickLocaleText(undefined, 'Events', 'hu', 'en', false), 'Events')
  })

  it('does not use another locale when fallback is off', () => {
    assert.equal(pickLocaleText({ en: 'Events' }, '', 'hu', 'en', false), '')
  })
})
