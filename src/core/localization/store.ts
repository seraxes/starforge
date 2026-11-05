import 'server-only'

import { getSiteChrome, saveSiteChrome } from '@/core/site-chrome/store'

import { normalizeLocalizationSettings } from './normalize'
import type { LocalizationSettings } from './types'

/** Load localization settings (from Site Chrome JSON storage). */
export async function getLocalizationSettings(): Promise<LocalizationSettings> {
  const chrome = await getSiteChrome()
  return normalizeLocalizationSettings({
    localesEnabled: chrome.localesEnabled,
    defaultLocale: chrome.defaultLocale,
    localeFallback: chrome.localeFallback,
  })
}

/**
 * Persist localization settings onto Site Chrome JSON.
 * Does not change offline/SEO/email/cookie fields.
 */
export async function saveLocalizationSettings(
  input: Partial<LocalizationSettings>,
): Promise<LocalizationSettings> {
  const current = await getLocalizationSettings()
  const next = normalizeLocalizationSettings({ ...current, ...input })
  const chrome = await saveSiteChrome({
    localesEnabled: next.localesEnabled,
    defaultLocale: next.defaultLocale,
    localeFallback: next.localeFallback,
  })
  return normalizeLocalizationSettings({
    localesEnabled: chrome.localesEnabled,
    defaultLocale: chrome.defaultLocale,
    localeFallback: chrome.localeFallback,
  })
}
