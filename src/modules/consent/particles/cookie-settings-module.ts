import React from 'react'

import { buildChromeConsentKey } from '@/core/i18n/content-locale-keys'
import { pickContentLocaleText } from '@/core/i18n/locale-text.server'
import type { StarforgeModule } from '@/core/modules/types'
import { MODULE_IDS, isCatalogModuleEnabled } from '@/core/settings'
import { getSiteChrome } from '@/core/site-chrome'

import { CookieSettings } from '../CookieSettings'

/**
 * cookie-settings particle — reopen control after consent is decided.
 * Policy copy / cookie scope from Site Chrome (same as ConsentShell).
 */
export const cookieSettingsModule: StarforgeModule = {
  id: 'cookie-settings',
  name: 'Cookie settings',
  description: 'Reopen cookie preferences after a choice exists (product:consent).',
  defaultWidth: 25,
  render: async ({ settings, slot }) => {
    if (!isCatalogModuleEnabled(settings, MODULE_IDS.consent)) {
      return null
    }

    const siteChrome = await getSiteChrome()
    const [privacyUrl, privacyLinkLabel] = await Promise.all([
      pickContentLocaleText(
        buildChromeConsentKey('privacyUrl'),
        siteChrome.consentPrivacyUrl,
      ),
      pickContentLocaleText(
        buildChromeConsentKey('privacyLinkLabel'),
        siteChrome.consentPrivacyLinkLabel,
      ),
    ])

    return React.createElement(CookieSettings, {
      privacyUrl,
      privacyLinkLabel,
      cookieDomain: siteChrome.cookieDomain,
      cookiePath: siteChrome.cookiePath,
      key: slot.id,
    })
  },
}
