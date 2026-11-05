import React from 'react'

import { SiteHeader } from '@/components/SiteHeader'
import { getAccessViewer } from '@/core/acl/access'
import { filterNavItemsForViewer } from '@/core/acl/nav-access'
import { getEnabledPublicLocaleEntries } from '@/core/i18n/enabled'
import { MODULE_IDS, isModuleToggleEnabled } from '@/core/settings/module-toggles'

import type { StarforgeModule } from '../types'

/**
 * Built-in particle wrapping the public brand + primary nav chrome.
 * Prefer **Logo** (image/text) + **Menu** particles for flexible layouts;
 * this remains a convenience combo. Links from Nav manager (site default);
 * gated by Modules (`product:primary-nav`). Includes locale switcher when
 * Localization has 2+ enabled locales (P2).
 */
export const siteHeaderModule: StarforgeModule = {
  id: 'site-header',
  name: 'Site Header',
  description:
    'Convenience brand + primary nav + locale switcher. Prefer Logo + Menu + Locale Switcher particles for flexible layouts.',
  builtin: true,
  defaultWidth: 100,
  render: async ({ settings, slot }) => {
    const showBrand = slot.config?.showBrand !== false
    let siteName = settings.siteName
    try {
      const { getSiteChrome } = await import('@/core/site-chrome')
      const chrome = await getSiteChrome()
      if (chrome.siteName.trim()) siteName = chrome.siteName.trim()
    } catch {
      // Site Chrome table may be missing before db:core:push.
    }
    const localesEnabled = await getEnabledPublicLocaleEntries()
    const navOn = isModuleToggleEnabled(settings, MODULE_IDS.primaryNav, {
      defaultEnabled: true,
    })
    if (!navOn) {
      return showBrand ? (
        <SiteHeader
          siteName={siteName}
          primaryNav={[]}
          compact
          localesEnabled={localesEnabled}
        />
      ) : localesEnabled.length > 1 ? (
        <SiteHeader
          siteName={siteName}
          primaryNav={[]}
          showBrand={false}
          compact
          localesEnabled={localesEnabled}
        />
      ) : null
    }
    const viewer = await getAccessViewer()
    const primaryNav = filterNavItemsForViewer(settings.primaryNav, viewer)
    return (
      <SiteHeader
        siteName={siteName}
        primaryNav={primaryNav}
        showBrand={showBrand}
        compact={!showBrand}
        localesEnabled={localesEnabled}
      />
    )
  },
}
