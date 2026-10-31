import React from 'react'

import { SiteHeader } from '@/components/SiteHeader'

import type { StarforgeModule } from '../types'

/**
 * Built-in particle wrapping the public brand + primary nav chrome.
 */
export const siteHeaderModule: StarforgeModule = {
  id: 'site-header',
  name: 'Site Header',
  description: 'Brand name and primary navigation.',
  builtin: true,
  defaultWidth: 12,
  render: ({ settings }) => (
    <SiteHeader siteName={settings.siteName} primaryNav={settings.primaryNav} />
  ),
}
