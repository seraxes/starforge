import 'server-only'

import { getSiteChromeForProxy, saveSiteChrome } from '@/core/site-chrome/store'

import { normalizeLocalizationSettings } from './normalize'
import type { LocalizationSettings } from './types'

/**
 * Load localization settings (from Site Chrome JSON storage).
 * Uses the live Chrome snapshot — not published-content `unstable_cache` —
 * so proxy i18n / offline plumbing cannot stall on `revalidateTag({ expire: 0 })`.
 */
export async function getLocalizationSettings(): Promise<LocalizationSettings> {
  const chrome = await getSiteChromeForProxy()
  return normalizeLocalizationSettings({
    localeCatalog: chrome.localeCatalog,
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
    localeCatalog: next.localeCatalog,
    localesEnabled: next.localesEnabled,
    defaultLocale: next.defaultLocale,
    localeFallback: next.localeFallback,
  })
  return normalizeLocalizationSettings({
    localeCatalog: chrome.localeCatalog,
    localesEnabled: chrome.localesEnabled,
    defaultLocale: chrome.defaultLocale,
    localeFallback: chrome.localeFallback,
  })
}
