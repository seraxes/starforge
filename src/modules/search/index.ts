import React from 'react'

import type { StarforgeModule } from '@/core/modules/types'
import { MODULE_IDS, isCatalogModuleEnabled } from '@/core/settings'

import { readSearchConfig } from './config'
import { SearchForm } from './SearchForm'

/**
 * Search particle — GET form to `/search`.
 * Gated by product:search + particle `search` toggles.
 */
export const searchModule: StarforgeModule = {
  id: 'search',
  name: 'Search',
  description:
    'Public search box → /search over published Payload pages (title / slug / meta).',
  defaultWidth: 50,
  navViews: [{ key: 'search', label: 'Search', href: '/search' }],
  render: ({ slot, settings }) => {
    if (!isCatalogModuleEnabled(settings, MODULE_IDS.search)) {
      return null
    }

    const cfg = readSearchConfig(slot.config)
    const compact = slot.width < 40

    return React.createElement(SearchForm, {
      heading: cfg.heading,
      placeholder: cfg.placeholder,
      buttonLabel: cfg.buttonLabel,
      compact,
    })
  },
}

export { SearchForm, type SearchFormProps } from './SearchForm'
export { SearchResults, type SearchResultsProps } from './SearchResults'
export {
  defaultSearchConfig,
  readSearchConfig,
  type SearchParticleConfig,
} from './config'
