import React from 'react'

import { buildChromeConsentKey } from '@/core/i18n/content-locale-keys'
import { pickContentLocaleText } from '@/core/i18n/locale-text.server'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { getSiteChrome } from '@/core/site-chrome'

import { ConsentBanner } from '../ConsentBanner'

/**
 * Public-shell contribution for product:consent (bodyEnd).
 * Loads Site Chrome policy copy itself so Core layout only hosts the slot.
 * Consent message / privacy strings resolve via content-locale files.
 */
export default async function ConsentShell() {
  const [settings, siteChrome] = await Promise.all([getSiteSettings(), getSiteChrome()])
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.consent)) return null

  const [message, privacyUrl, privacyLinkLabel] = await Promise.all([
    pickContentLocaleText(buildChromeConsentKey('message'), siteChrome.consentMessage),
    pickContentLocaleText(buildChromeConsentKey('privacyUrl'), siteChrome.consentPrivacyUrl),
    pickContentLocaleText(
      buildChromeConsentKey('privacyLinkLabel'),
      siteChrome.consentPrivacyLinkLabel,
    ),
  ])

  return (
    <ConsentBanner
      message={message}
      privacyUrl={privacyUrl}
      privacyLinkLabel={privacyLinkLabel}
      cookieDomain={siteChrome.cookieDomain}
      cookiePath={siteChrome.cookiePath}
    />
  )
}
