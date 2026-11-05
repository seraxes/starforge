import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildLanguageAlternates } from './alternates'
import { isLocaleAwareNavItemActive, navHref } from './nav'
import {
  hasLocalePrefix,
  pathnameWithoutLocale,
  stripLocalePrefix,
  withLocalePrefix,
} from './path'

describe('stripLocalePrefix', () => {
  it('strips known locale prefixes', () => {
    assert.deepEqual(stripLocalePrefix('/en'), { locale: 'en', pathname: '/' })
    assert.deepEqual(stripLocalePrefix('/en/'), { locale: 'en', pathname: '/' })
    assert.deepEqual(stripLocalePrefix('/hu/about'), {
      locale: 'hu',
      pathname: '/about',
    })
    assert.deepEqual(stripLocalePrefix('/en/login?next=/admin'), {
      locale: 'en',
      pathname: '/login',
    })
  })

  it('leaves non-locale and admin paths alone', () => {
    assert.deepEqual(stripLocalePrefix('/admin'), {
      locale: null,
      pathname: '/admin',
    })
    assert.deepEqual(stripLocalePrefix('/cms/admin'), {
      locale: null,
      pathname: '/cms/admin',
    })
    assert.deepEqual(stripLocalePrefix('/about'), {
      locale: null,
      pathname: '/about',
    })
    assert.deepEqual(stripLocalePrefix('/'), { locale: null, pathname: '/' })
  })
})

describe('pathnameWithoutLocale + withLocalePrefix', () => {
  it('round-trips public paths', () => {
    assert.equal(pathnameWithoutLocale('/en/search'), '/search')
    assert.equal(withLocalePrefix('/search', 'hu'), '/hu/search')
    assert.equal(withLocalePrefix('/', 'en'), '/en')
  })

  it('detects locale prefixes', () => {
    assert.equal(hasLocalePrefix('/en/x'), true)
    assert.equal(hasLocalePrefix('/admin'), false)
  })
})

describe('navHref + isLocaleAwareNavItemActive', () => {
  it('prefixes internal nav hrefs', () => {
    assert.equal(navHref('/about', 'hu'), '/hu/about')
    assert.equal(navHref('/', 'en'), '/en')
    assert.equal(navHref('https://example.com', 'en'), 'https://example.com')
  })

  it('matches active state with or without locale prefix on pathname', () => {
    assert.equal(isLocaleAwareNavItemActive('/en/about', '/about'), true)
    assert.equal(isLocaleAwareNavItemActive('/about', '/about'), true)
    assert.equal(isLocaleAwareNavItemActive('/hu/about', '/contact'), false)
    assert.equal(isLocaleAwareNavItemActive('/en', '/'), true)
  })
})

describe('buildLanguageAlternates', () => {
  it('emits enabled locales + x-default', () => {
    const alts = buildLanguageAlternates('/about', ['en', 'hu'], 'https://example.com')
    assert.equal(alts.en, 'https://example.com/en/about')
    assert.equal(alts.hu, 'https://example.com/hu/about')
    assert.equal(alts['x-default'], 'https://example.com/en/about')
  })
})
