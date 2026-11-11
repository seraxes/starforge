import 'server-only'

import { getLocale } from 'next-intl/server'

import { getLocalizationSettings } from '@/core/localization/store'

import {
  loadContentLocaleCatalog,
  pickFromContentCatalog,
} from './content-locales/store'
import {
  contentLocaleOptions,
  pickLocaleText,
  type ContentLocaleOption,
  type LocaleTextMap,
} from './locale-text'

export async function getContentLocaleOptions(): Promise<ContentLocaleOption[]> {
  const settings = await getLocalizationSettings()
  return contentLocaleOptions({
    catalog: settings.localeCatalog,
    enabled: settings.localesEnabled,
    defaultLocale: settings.defaultLocale,
  })
}

export async function getLocaleTextContext(): Promise<{
  locale: string
  defaultLocale: string
  fallbackEnabled: boolean
}> {
  const settings = await getLocalizationSettings()
  let locale = settings.defaultLocale
  try {
    const requested = await getLocale()
    if (requested.trim()) locale = requested.trim()
  } catch {
    // Outside a public request (seed, admin save).
  }
  return {
    locale,
    defaultLocale: settings.defaultLocale,
    fallbackEnabled: settings.localeFallback,
  }
}

/** Public label for the request locale, with Localization fallback rules. */
export async function pickRequestLocaleText(
  map: LocaleTextMap | undefined,
  fallback: string,
): Promise<string> {
  const ctx = await getLocaleTextContext()
  return pickLocaleText(map, fallback, ctx.locale, ctx.defaultLocale, ctx.fallbackEnabled)
}

/**
 * Resolve a content-string key from language files, then Localization fallback,
 * then an optional legacy embedded map, then the entity scalar.
 */
export async function pickContentLocaleText(
  key: string,
  fallback: string,
  legacyMap?: LocaleTextMap,
): Promise<string> {
  const ctx = await getLocaleTextContext()
  const current = pickFromContentCatalog(await loadContentLocaleCatalog(ctx.locale), key)
  if (current) return current
  if (ctx.fallbackEnabled && ctx.locale !== ctx.defaultLocale) {
    const fromDefault = pickFromContentCatalog(
      await loadContentLocaleCatalog(ctx.defaultLocale),
      key,
    )
    if (fromDefault) return fromDefault
  }
  if (legacyMap) {
    return pickLocaleText(
      legacyMap,
      fallback,
      ctx.locale,
      ctx.defaultLocale,
      ctx.fallbackEnabled,
    )
  }
  return fallback.trim()
}
