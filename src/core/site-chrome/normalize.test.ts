import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { DEFAULT_LOCALE, LOCALES } from '@/core/i18n/locales'

import {
  DEFAULT_AUTH_POST_LOGIN_URL,
  DEFAULT_AUTH_POST_LOGOUT_URL,
  DEFAULT_AUTH_POST_REGISTER_URL,
  DEFAULT_OFFLINE_LAYOUT_ID,
  DEFAULT_SITE_CHROME,
} from './defaults'
import {
  normalizeSiteChrome,
  parseSiteChromeJson,
  siteChromeDocumentNeedsLocaleHeal,
} from './normalize'

describe('normalizeSiteChrome offline + auth success URLs', () => {
  it('fills offlineLayoutId and auth success URL defaults when missing', () => {
    const chrome = normalizeSiteChrome({ siteName: 'Test' })
    assert.equal(chrome.offlineLayoutId, DEFAULT_OFFLINE_LAYOUT_ID)
    assert.equal(chrome.authPostLoginUrl, DEFAULT_AUTH_POST_LOGIN_URL)
    assert.equal(chrome.authPostRegisterUrl, DEFAULT_AUTH_POST_REGISTER_URL)
    assert.equal(chrome.authPostLogoutUrl, DEFAULT_AUTH_POST_LOGOUT_URL)
  })

  it('rejects open-redirect style auth success URLs', () => {
    const chrome = normalizeSiteChrome({
      authPostLoginUrl: 'https://evil.example/',
      authPostRegisterUrl: '//evil.example',
      authPostLogoutUrl: '/account',
    })
    assert.equal(chrome.authPostLoginUrl, DEFAULT_AUTH_POST_LOGIN_URL)
    assert.equal(chrome.authPostRegisterUrl, DEFAULT_AUTH_POST_REGISTER_URL)
    assert.equal(chrome.authPostLogoutUrl, '/account')
  })
})

describe('normalizeSiteChrome locale fields', () => {
  it('fills localeCatalog + localesEnabled + defaultLocale + localeFallback when missing', () => {
    const chrome = normalizeSiteChrome({
      siteName: 'Test',
      offlineEnabled: false,
    })
    assert.deepEqual(chrome.localesEnabled, [...LOCALES])
    assert.equal(chrome.defaultLocale, DEFAULT_LOCALE)
    assert.equal(chrome.localeFallback, true)
    assert.ok(chrome.localeCatalog.some((e) => e.code === 'en'))
  })

  it('keeps valid localesEnabled arrays and coerces default into enabled', () => {
    const chrome = normalizeSiteChrome({
      localeCatalog: [
        { code: 'en', label: 'English' },
        { code: 'hu', label: 'Magyar' },
        { code: 'de', label: 'Deutsch' },
      ],
      localesEnabled: ['hu', 'de'],
      defaultLocale: 'en',
      localeFallback: false,
    })
    assert.deepEqual(chrome.localesEnabled, ['hu', 'de'])
    assert.equal(chrome.defaultLocale, 'hu')
    assert.equal(chrome.localeFallback, false)
    assert.ok(chrome.localeCatalog.some((e) => e.code === 'de'))
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
    assert.equal(parsed.localeFallback, DEFAULT_SITE_CHROME.localeFallback)
    assert.ok(parsed.localeCatalog.length >= 2)
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

  it('siteChromeDocumentNeedsLocaleHeal detects missing localeCatalog', () => {
    assert.equal(
      siteChromeDocumentNeedsLocaleHeal(
        JSON.stringify({
          localesEnabled: ['en'],
          defaultLocale: 'en',
          localeFallback: true,
        }),
      ),
      true,
    )
  })

  it('siteChromeDocumentNeedsLocaleHeal detects missing localeFallback', () => {
    assert.equal(
      siteChromeDocumentNeedsLocaleHeal(
        JSON.stringify({
          localesEnabled: ['en'],
          localeCatalog: [{ code: 'en', label: 'English' }],
          defaultLocale: 'en',
        }),
      ),
      true,
    )
  })
})
