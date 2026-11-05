import 'server-only'

import { getLocalizationSettings } from '@/core/localization/store'

import {
  DEFAULT_LOCALE,
  DEFAULT_LOCALE_CATALOG,
  LOCALES,
  isValidLocaleCode,
  registerPublicLocaleCodes,
  type AppLocale,
  type LocaleCatalogEntry,
} from './locales'

function syncRegistry(settings: {
  localeCatalog: LocaleCatalogEntry[]
  localesEnabled: string[]
}): void {
  const codes = [
    ...settings.localeCatalog.map((e) => e.code),
    ...settings.localesEnabled,
  ]
  registerPublicLocaleCodes(codes)
}

/**
 * Enabled public locales from Localization admin (`/admin/localization`).
 * Falls back to the bootstrap catalog when settings are empty/unavailable.
 * Also refreshes the sync path-prefix registry for stripLocalePrefix.
 */
export async function getEnabledPublicLocales(): Promise<AppLocale[]> {
  try {
    const settings = await getLocalizationSettings()
    syncRegistry(settings)
    const enabled = settings.localesEnabled.filter(isValidLocaleCode)
    return enabled.length > 0 ? enabled : [...LOCALES]
  } catch {
    registerPublicLocaleCodes(LOCALES)
    return [...LOCALES]
  }
}

/** Full locale catalog (code + label) from Localization settings. */
export async function getPublicLocaleCatalog(): Promise<LocaleCatalogEntry[]> {
  try {
    const settings = await getLocalizationSettings()
    syncRegistry(settings)
    if (settings.localeCatalog.length > 0) {
      return settings.localeCatalog.map((e) => ({ ...e }))
    }
  } catch {
    // ignore
  }
  return DEFAULT_LOCALE_CATALOG.map((e) => ({ ...e }))
}

/** Enabled catalog entries (for switcher labels). */
export async function getEnabledPublicLocaleEntries(): Promise<LocaleCatalogEntry[]> {
  const [catalog, enabled] = await Promise.all([
    getPublicLocaleCatalog(),
    getEnabledPublicLocales(),
  ])
  const enabledSet = new Set(enabled)
  const entries = catalog.filter((e) => enabledSet.has(e.code))
  return entries.length > 0
    ? entries
    : DEFAULT_LOCALE_CATALOG.map((e) => ({ ...e }))
}

/** Default public locale from Localization settings (must be enabled). */
export async function getPublicDefaultLocale(): Promise<AppLocale> {
  try {
    const settings = await getLocalizationSettings()
    if (isValidLocaleCode(settings.defaultLocale)) {
      const enabled = settings.localesEnabled.filter(isValidLocaleCode)
      if (enabled.length === 0 || enabled.includes(settings.defaultLocale)) {
        return settings.defaultLocale
      }
      return enabled[0] ?? DEFAULT_LOCALE
    }
  } catch {
    // ignore
  }
  return DEFAULT_LOCALE
}
