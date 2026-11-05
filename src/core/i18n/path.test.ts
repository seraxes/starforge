import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

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
