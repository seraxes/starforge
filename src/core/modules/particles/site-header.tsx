import React from 'react'

import { SiteHeader } from '@/components/SiteHeader'
import { getAccessViewer } from '@/core/acl/access'
import { filterNavItemsForViewer } from '@/core/acl/nav-access'
import { MODULE_IDS, isModuleToggleEnabled } from '@/core/settings/module-toggles'

import type { StarforgeModule } from '../types'

/**
 * Built-in particle wrapping the public brand + primary nav chrome.
 * Prefer **Logo** (image/text) + **Menu** particles for flexible layouts;
 * this remains a convenience combo. Links from Nav manager (site default);
 * gated by Modules (`product:primary-nav`).
 */
export const siteHeaderModule: StarforgeModule = {
  id: 'site-header',
  name: 'Site Header',
  description:
    'Convenience brand + primary nav. Prefer Logo (text/image) + Menu particles when assembling the header row.',
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
    const navOn = isModuleToggleEnabled(settings, MODULE_IDS.primaryNav, {
      defaultEnabled: true,
    })
    if (!navOn) {
      return showBrand ? <SiteHeader siteName={siteName} primaryNav={[]} compact /> : null
    }
    const viewer = await getAccessViewer()
    const primaryNav = filterNavItemsForViewer(settings.primaryNav, viewer)
    return (
      <SiteHeader
        siteName={siteName}
        primaryNav={primaryNav}
        showBrand={showBrand}
        compact={!showBrand}
      />
    )
  },
}
