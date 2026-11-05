import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  DEFAULT_FEATURE_FLAGS,
  DEFAULT_SITE_SETTINGS,
} from '@/core/settings/defaults'
import { isCatalogModuleEnabled } from '@/core/settings/module-catalog'
import { MODULE_IDS } from '@/core/settings/module-toggles'
import type { SiteSettingsData } from '@/core/settings/defaults'

import { buildAdminNavGroups } from './build'
import { resolveEnabledAdminNavModuleIds } from './enabled-modules'

function settingsWithToggles(
  moduleToggles: SiteSettingsData['moduleToggles'],
): SiteSettingsData {
  return {
    ...DEFAULT_SITE_SETTINGS,
    features: { ...DEFAULT_FEATURE_FLAGS },
    primaryNav: [],
    moduleToggles,
  }
}

const flags = {
  nav: true,
  layout: true,
  pageSettings: true,
  cms: true,
}

describe('resolveEnabledAdminNavModuleIds + Email contribution', () => {
  it('includes product:email-manager when toggles are empty (defaultEnabled)', () => {
    const settings = settingsWithToggles({})
    assert.equal(isCatalogModuleEnabled(settings, MODULE_IDS.emailManager), true)
    assert.equal(isCatalogModuleEnabled(settings, MODULE_IDS.forms), true)
    assert.equal(isCatalogModuleEnabled(settings, MODULE_IDS.media), true)

    const enabled = resolveEnabledAdminNavModuleIds(settings)
    assert.ok(enabled.has(MODULE_IDS.emailManager))
    assert.ok(enabled.has(MODULE_IDS.forms))
    assert.ok(enabled.has(MODULE_IDS.media))
    assert.ok(enabled.has(MODULE_IDS.redirects))

    const groups = buildAdminNavGroups({
      surface: 'core',
      flags,
      enabledModuleIds: enabled,
    })
    const ids = groups.map((g) => g.id)
    assert.equal(ids[0], 'dashboard')
    assert.equal(
      groups.find((g) => g.id === 'dashboard')?.links[0]?.href,
      '/admin',
    )
    assert.ok(ids.includes('email'), `expected Email in ${ids.join(',')}`)
    assert.ok(ids.indexOf('forms') < ids.indexOf('email'))
    assert.ok(ids.indexOf('email') < ids.indexOf('redirects'))
    const email = groups.find((g) => g.id === 'email')
    assert.equal(email?.label, 'Email')
    assert.ok(email?.links.some((l) => l.href === '/admin/email' && l.label === 'Rules'))
    assert.ok(
      email?.links.some((l) => l.href === '/admin/email/templates' && l.label === 'Templates'),
    )
  })

  it('hides Email when product:email-manager is explicitly off (Media stays)', () => {
    const settings = settingsWithToggles({
      [MODULE_IDS.emailManager]: false,
      [MODULE_IDS.forms]: true,
      [MODULE_IDS.redirects]: true,
      [MODULE_IDS.media]: true,
    })
    assert.equal(isCatalogModuleEnabled(settings, MODULE_IDS.emailManager), false)
    assert.equal(isCatalogModuleEnabled(settings, MODULE_IDS.media), true)

    const enabled = resolveEnabledAdminNavModuleIds(settings)
    assert.equal(enabled.has(MODULE_IDS.emailManager), false)
    assert.ok(enabled.has(MODULE_IDS.media))

    const groups = buildAdminNavGroups({
      surface: 'core',
      flags,
      enabledModuleIds: enabled,
    })
    assert.equal(
      groups.some((g) => g.id === 'email'),
      false,
    )
    assert.ok(groups.some((g) => g.id === 'media'))
  })
})
