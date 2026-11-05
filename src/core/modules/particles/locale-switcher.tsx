import React from 'react'

import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { getEnabledPublicLocaleEntries } from '@/core/i18n/enabled'

import type { StarforgeModule } from '../types'
import { readLocaleSwitcherConfig } from './config'

/**
 * Locale Switcher particle — enabled locales from Localization admin.
 * Same bare path; switches only the `/{locale}` prefix (P2).
 */
export const localeSwitcherModule: StarforgeModule = {
  id: 'locale-switcher',
  name: 'Locale Switcher',
  description:
    'Language links for enabled public locales (Localization settings). Switches /en/… ↔ /hu/… (or admin-added codes) keeping the same path.',
  builtin: true,
  defaultWidth: 25,
  render: async ({ slot }) => {
    const cfg = readLocaleSwitcherConfig(slot.config)
    const locales = await getEnabledPublicLocaleEntries()
    if (locales.length < 2) {
      return (
        <div
          className="sf-locale-switcher sf-locale-switcher-empty"
          data-sf-particle="locale-switcher"
          data-sf-slot={slot.id}
        >
          <p className="layout-muted">Enable at least two locales under Localization.</p>
        </div>
      )
    }

    return (
      <div
        className="sf-locale-switcher-wrap"
        data-sf-particle="locale-switcher"
        data-sf-slot={slot.id}
      >
        <LocaleSwitcher
          locales={locales}
          ariaLabel={cfg.ariaLabel}
          display={cfg.display}
        />
      </div>
    )
  },
}
