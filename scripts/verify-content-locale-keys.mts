/**
 * Content-locale key round-trip (no disk I/O).
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildLayoutSlotKey,
  buildNavItemKey,
  contentLocaleFileRefForKey,
  isValidContentLocaleKey,
  parseContentLocaleKey,
} from '../src/core/i18n/content-locale-keys.ts'

describe('content locale keys', () => {
  it('builds and parses layout slot keys', () => {
    const key = buildLayoutSlotKey({
      layoutId: 'default',
      slotId: 'header-logo',
      field: 'text',
    })
    assert.equal(key, 'layout.default.slot.header-logo.text')
    assert.equal(isValidContentLocaleKey(key), true)
    assert.deepEqual(parseContentLocaleKey(key), {
      kind: 'layout',
      layoutId: 'default',
      slotId: 'header-logo',
      field: 'text',
    })
    assert.deepEqual(contentLocaleFileRefForKey(key), {
      scope: 'layouts',
      ownerId: 'default',
    })
  })

  it('builds nested social item keys', () => {
    const key = buildLayoutSlotKey({
      layoutId: 'default',
      slotId: 'footer-social',
      field: 'label',
      itemId: 'si_abc',
    })
    assert.equal(key, 'layout.default.slot.footer-social.item.si_abc.label')
    assert.equal(parseContentLocaleKey(key)?.kind, 'layout')
  })

  it('builds nav keys', () => {
    const key = buildNavItemKey({
      menuId: 'main',
      itemId: 'ni_abc',
      field: 'browserTitle',
    })
    assert.equal(key, 'nav.main.item.ni_abc.browserTitle')
    assert.deepEqual(contentLocaleFileRefForKey(key), { scope: 'nav', ownerId: 'main' })
  })

  it('rejects invalid keys', () => {
    assert.equal(isValidContentLocaleKey('not-a-key'), false)
    assert.equal(isValidContentLocaleKey('layout.default.slot.x.bogus'), false)
  })
})
