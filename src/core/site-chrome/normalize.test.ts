import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { DEFAULT_LOCALE, LOCALES } from '@/core/i18n/locales'

import { DEFAULT_SITE_CHROME } from './defaults'
import {
  normalizeSiteChrome,
  parseSiteChromeJson,
  siteChromeDocumentNeedsLocaleHeal,
} from './normalize'

describe('normalizeSiteChrome locale stub', () => {
  it('fills localesEnabled + defaultLocale when missing', () => {
    const chrome = normalizeSiteChrome({
      siteName: 'Test',
      offlineEnabled: false,
    })
    assert.deepEqual(chrome.localesEnabled, [...LOCALES])
    assert.equal(chrome.defaultLocale, DEFAULT_LOCALE)
  })

  it('keeps valid localesEnabled arrays', () => {
    const chrome = normalizeSiteChrome({
      localesEnabled: ['hu'],
      defaultLocale: 'hu',
    })
    assert.deepEqual(chrome.localesEnabled, ['hu'])
    assert.equal(chrome.defaultLocale, 'hu')
  })

  it('parseSiteChromeJson soft-heals pre-i18n JSON', () => {
    const legacy = JSON.stringify({
      version: 1,
      siteName: 'Legacy',
      offlineEnabled: false,
      offlineMessage: 'down',
      captchaEnabled: false,
      captchaProvider: 'none',
      captchaOnRegister: false,
      captchaOnAuthRecovery: false,
      emailEnabled: false,
      emailProvider: 'console',
      emailFrom: '',
      defaultDescription: '',
      defaultOgImage: '',
      robotsMeta: 'index, follow',
      robotsTxt: 'User-agent: *\nAllow: /',
      contentRights: '',
      cookieDomain: '',
      cookiePath: '/',
      consentMessage: 'cookies',
      consentPrivacyUrl: '',
      consentPrivacyLinkLabel: 'Privacy',
    })
    assert.equal(siteChromeDocumentNeedsLocaleHeal(legacy), true)
    const parsed = parseSiteChromeJson(legacy)
    assert.ok(parsed)
    assert.deepEqual(parsed.localesEnabled, [...DEFAULT_SITE_CHROME.localesEnabled])
    assert.equal(parsed.defaultLocale, DEFAULT_SITE_CHROME.defaultLocale)
    assert.equal(siteChromeDocumentNeedsLocaleHeal(JSON.stringify(parsed)), false)
  })

  it('siteChromeDocumentNeedsLocaleHeal detects null localesEnabled', () => {
    assert.equal(
      siteChromeDocumentNeedsLocaleHeal(
        JSON.stringify({ localesEnabled: null, defaultLocale: 'en' }),
      ),
      true,
    )
  })
})
