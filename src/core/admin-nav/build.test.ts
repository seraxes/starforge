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
    assert.ok(enabled.has(MODULE_IDS.events))

    const groups = buildAdminNavGroups({
      surface: 'core',
      flags,
      enabledModuleIds: enabled,
    })
    const ids = groups.map((g) => g.id)
    assert.equal(ids[0], 'dashboard')
    assert.equal(groups.find((g) => g.id === 'dashboard')?.href, '/admin')
    assert.equal(
      groups.find((g) => g.id === 'dashboard')?.links[0]?.href,
      '/admin',
    )
    // Bands: home → shell → structure/content → products → access/platform
    assert.ok(ids.indexOf('site-chrome') < ids.indexOf('localization'))
    assert.ok(ids.indexOf('localization') < ids.indexOf('navigation'))
    assert.ok(ids.indexOf('navigation') < ids.indexOf('skins'))
    assert.ok(ids.indexOf('skins') < ids.indexOf('cms'))
    assert.ok(ids.indexOf('cms') < ids.indexOf('media'))
    const skins = groups.find((g) => g.id === 'skins')
    assert.equal(skins?.label, 'Skins')
    assert.equal(skins?.href, '/admin/skins')
    assert.equal(skins?.expandable, true)
    assert.deepEqual(
      skins?.links.map((l) => l.label),
      ['Outline', 'Particle Defaults'],
    )
    const outline = skins?.links.find((l) => l.label === 'Outline')
    assert.equal(outline?.href, '/admin/outlines')
    assert.deepEqual(
      outline?.children?.map((l) => l.label),
      ['Layout', 'Styles', 'Page settings', 'Assigned Menu'],
    )
    assert.ok(ids.includes('email'), `expected Email in ${ids.join(',')}`)
    assert.ok(ids.includes('events'), `expected Events in ${ids.join(',')}`)
    assert.ok(ids.indexOf('media') < ids.indexOf('forms'))
    assert.ok(ids.indexOf('forms') < ids.indexOf('email'))
    assert.ok(ids.indexOf('email') < ids.indexOf('events'))
    assert.ok(ids.indexOf('events') < ids.indexOf('redirects'))
    assert.ok(ids.indexOf('redirects') < ids.indexOf('users'))
    assert.ok(ids.indexOf('users') < ids.indexOf('site-settings'))
    assert.equal(ids[ids.length - 1], 'site-settings')
    // Profiles is not top-level — Settings lives under Users.
    assert.equal(ids.includes('profiles'), false)
    const users = groups.find((g) => g.id === 'users')
    assert.ok(
      users?.links.some(
        (l) => l.href === '/admin/profiles/settings' && l.label === 'Profile settings',
      ),
      `expected Profile settings under Users, got ${users?.links.map((l) => l.label).join(',')}`,
    )
    const email = groups.find((g) => g.id === 'email')
    assert.equal(email?.label, 'Email')
    assert.ok(email?.links.some((l) => l.href === '/admin/email' && l.label === 'Rules'))
    assert.ok(
      email?.links.some((l) => l.href === '/admin/email/templates' && l.label === 'Templates'),
    )
    const events = groups.find((g) => g.id === 'events')
    assert.equal(events?.label, 'Events')
    assert.ok(events?.links.some((l) => l.href === '/admin/events' && l.label === 'Events'))
    assert.ok(
      events?.links.some((l) => l.href === '/admin/events/venues' && l.label === 'Venues'),
    )
    assert.ok(
      events?.links.some((l) => l.href === '/admin/events/settings' && l.label === 'Settings'),
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
