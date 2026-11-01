import React from 'react'

import { SiteHeader } from '@/components/SiteHeader'
import { MODULE_IDS, isModuleToggleEnabled } from '@/core/settings/module-toggles'

import type { StarforgeModule } from '../types'

/**
 * Built-in particle wrapping the public brand + primary nav chrome.
 * Links come from Nav manager (site default menu); gated by Modules
 * (`product:primary-nav`).
 */
export const siteHeaderModule: StarforgeModule = {
  id: 'site-header',
  name: 'Site Header',
  description: 'Brand name and primary navigation.',
  builtin: true,
  defaultWidth: 100,
  render: ({ settings }) => {
    const navOn = isModuleToggleEnabled(settings, MODULE_IDS.primaryNav, {
      defaultEnabled: true,
    })
    return (
      <SiteHeader
        siteName={settings.siteName}
        primaryNav={navOn ? settings.primaryNav : []}
        compact={!navOn}
      />
    )
  },
}
