import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { normalizePwaModuleSettings } from './normalize'
import { DEFAULT_PWA_MODULE_SETTINGS } from './types'

describe('normalizePwaModuleSettings', () => {
  it('applies defaults for empty input', () => {
    const next = normalizePwaModuleSettings(null)
    assert.equal(next.themeColor, DEFAULT_PWA_MODULE_SETTINGS.themeColor)
    assert.equal(next.display, 'standalone')
    assert.equal(next.startUrl, '/')
  })

  it('accepts hex colors and display modes', () => {
    const next = normalizePwaModuleSettings({
      shortName: 'SF',
      themeColor: '#abc',
      backgroundColor: '#112233',
      display: 'minimal-ui',
      startUrl: 'events',
      iconMediaId: '42',
      iconUrl: '/media/icon.png',
    })
    assert.equal(next.shortName, 'SF')
    assert.equal(next.themeColor, '#abc')
    assert.equal(next.backgroundColor, '#112233')
    assert.equal(next.display, 'minimal-ui')
    assert.equal(next.startUrl, '/events')
    assert.equal(next.iconMediaId, '42')
  })

  it('rejects bad colors and display', () => {
    const next = normalizePwaModuleSettings({
      themeColor: 'red',
      backgroundColor: 'nope',
      display: 'fullscreen',
    })
    assert.equal(next.themeColor, DEFAULT_PWA_MODULE_SETTINGS.themeColor)
    assert.equal(next.backgroundColor, DEFAULT_PWA_MODULE_SETTINGS.backgroundColor)
    assert.equal(next.display, 'standalone')
  })
})
