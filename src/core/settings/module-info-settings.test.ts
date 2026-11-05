import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  findExistingModuleSettingsHref,
  isCoreModuleInfoSettingsHref,
  moduleIdFromPathSegment,
  moduleIdPathSegment,
  moduleInfoSettingsHref,
  resolveModuleInfoSettingsHref,
} from './module-info-settings'

describe('module-info-settings', () => {
  it('round-trips path segments for colon ids', () => {
    assert.equal(moduleIdPathSegment('product:media'), 'product~media')
    assert.equal(moduleIdFromPathSegment('product~media'), 'product:media')
    assert.equal(moduleIdFromPathSegment('atom~custom-css-js'), 'atom:custom-css-js')
    assert.equal(moduleIdFromPathSegment(encodeURIComponent('logo')), 'logo')
  })

  it('builds the Core host href', () => {
    assert.equal(
      moduleInfoSettingsHref('product:email-manager'),
      '/admin/settings/modules/product~email-manager',
    )
    assert.equal(moduleInfoSettingsHref('logo'), '/admin/settings/modules/logo')
  })

  it('reuses Media and Forms Settings menus', () => {
    assert.equal(findExistingModuleSettingsHref('product:media'), '/admin/media/settings')
    assert.equal(findExistingModuleSettingsHref('product:forms'), '/admin/forms/settings')
    assert.equal(
      resolveModuleInfoSettingsHref('product:media'),
      '/admin/media/settings',
    )
    assert.equal(
      resolveModuleInfoSettingsHref('product:forms'),
      '/admin/forms/settings',
    )
    assert.equal(isCoreModuleInfoSettingsHref('/admin/media/settings', 'product:media'), false)
  })

  it('falls back to Core host when no Settings menu exists', () => {
    const href = resolveModuleInfoSettingsHref('product:consent')
    assert.equal(href, '/admin/settings/modules/product~consent')
    assert.equal(isCoreModuleInfoSettingsHref(href, 'product:consent'), true)
    assert.equal(findExistingModuleSettingsHref('logo'), null)
  })
})
