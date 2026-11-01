import React from 'react'

import { SiteHeader } from '@/components/SiteHeader'
import { filterNavItemsForViewer, getAccessViewer } from '@/core/acl'
import { MODULE_IDS, isModuleToggleEnabled } from '@/core/settings/module-toggles'

import type { StarforgeModule } from '../types'

/**
 * Built-in particle wrapping the public brand + primary nav chrome.
 * Links come from Nav manager (site default menu); gated by Modules
 * (`product:primary-nav`). Group/registered access levels are filtered
 * against the current session (SF-41).
 */
export const siteHeaderModule: StarforgeModule = {
  id: 'site-header',
  name: 'Site Header',
  description: 'Brand name and primary navigation.',
  builtin: true,
  defaultWidth: 100,
  render: async ({ settings }) => {
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
      return <SiteHeader siteName={siteName} primaryNav={[]} compact />
    }
    const viewer = await getAccessViewer()
    const primaryNav = filterNavItemsForViewer(settings.primaryNav, viewer)
    return <SiteHeader siteName={siteName} primaryNav={primaryNav} />
  },
}
