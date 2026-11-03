import React from 'react'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { getSiteChrome } from '@/core/site-chrome'

import { ConsentBanner } from '../ConsentBanner'

/**
 * Public-shell contribution for product:consent (bodyEnd).
 * Loads Site Chrome policy copy itself so Core layout only hosts the slot.
 */
export default async function ConsentShell() {
  const [settings, siteChrome] = await Promise.all([getSiteSettings(), getSiteChrome()])
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.consent)) return null

  return (
    <ConsentBanner
      message={siteChrome.consentMessage}
      privacyUrl={siteChrome.consentPrivacyUrl}
      privacyLinkLabel={siteChrome.consentPrivacyLinkLabel}
      cookieDomain={siteChrome.cookieDomain}
      cookiePath={siteChrome.cookiePath}
    />
  )
}
