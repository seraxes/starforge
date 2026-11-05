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
    assert.ok(settings.localeCatalog.some((e) => e.code === 'en'))
    assert.ok(settings.localeCatalog.some((e) => e.code === 'hu'))
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

  it('accepts admin-added catalog codes and drops invalid ones', () => {
    const settings = normalizeLocalizationSettings({
      localeCatalog: [
        { code: 'en', label: 'English' },
        { code: 'hu', label: 'Magyar' },
        { code: 'de', label: 'Deutsch' },
        { code: '!!', label: 'Bad' },
      ],
      localesEnabled: ['en', 'de', 'xx', 'en'],
      defaultLocale: 'de',
    })
    assert.ok(settings.localeCatalog.some((e) => e.code === 'de'))
    assert.equal(settings.localeCatalog.some((e) => e.code === '!!'), false)
    assert.deepEqual(settings.localesEnabled, ['en', 'de'])
    assert.equal(settings.defaultLocale, 'de')
    assert.equal(settings.localeFallback, DEFAULT_LOCALIZATION.localeFallback)
  })

  it('normalizes en-us to en-US in catalog', () => {
    const settings = normalizeLocalizationSettings({
      localeCatalog: [
        { code: 'en', label: 'English' },
        { code: 'hu', label: 'Magyar' },
        { code: 'en-us', label: 'English (US)' },
      ],
      localesEnabled: ['en-US'],
      defaultLocale: 'en-US',
    })
    assert.ok(settings.localeCatalog.some((e) => e.code === 'en-US'))
    assert.deepEqual(settings.localesEnabled, ['en-US'])
  })
})
