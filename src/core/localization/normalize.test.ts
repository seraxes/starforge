import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { DEFAULT_LOCALE, LOCALES } from '@/core/i18n/locales'

import { DEFAULT_LOCALIZATION } from './defaults'
import { normalizeLocalizationSettings } from './normalize'

describe('normalizeLocalizationSettings', () => {
  it('fills defaults when missing', () => {
    const settings = normalizeLocalizationSettings({})
    assert.deepEqual(settings.localesEnabled, [...LOCALES])
    assert.equal(settings.defaultLocale, DEFAULT_LOCALE)
    assert.equal(settings.localeFallback, true)
  })

  it('keeps a valid subset and coerces default into enabled list', () => {
    const settings = normalizeLocalizationSettings({
      localesEnabled: ['hu'],
      defaultLocale: 'en',
      localeFallback: false,
    })
    assert.deepEqual(settings.localesEnabled, ['hu'])
    assert.equal(settings.defaultLocale, 'hu')
    assert.equal(settings.localeFallback, false)
  })

  it('drops unknown locale codes', () => {
    const settings = normalizeLocalizationSettings({
      localesEnabled: ['en', 'xx', 'hu', 'en'],
      defaultLocale: 'hu',
    })
    assert.deepEqual(settings.localesEnabled, ['en', 'hu'])
    assert.equal(settings.defaultLocale, 'hu')
    assert.equal(settings.localeFallback, DEFAULT_LOCALIZATION.localeFallback)
  })
})
