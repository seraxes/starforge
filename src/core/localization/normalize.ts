import { DEFAULT_LOCALE, isAppLocale } from '@/core/i18n/locales'

import { DEFAULT_LOCALIZATION } from './defaults'
import type { LocalizationSettings } from './types'

function normalizeLocalesEnabled(value: unknown): string[] {
  if (!Array.isArray(value)) return [...DEFAULT_LOCALIZATION.localesEnabled]
  const seen = new Set<string>()
  const out: string[] = []
  for (const entry of value) {
    if (!isAppLocale(entry) || seen.has(entry)) continue
    seen.add(entry)
    out.push(entry)
  }
  return out.length > 0 ? out : [...DEFAULT_LOCALIZATION.localesEnabled]
}

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

/** Normalize unknown input into LocalizationSettings. */
export function normalizeLocalizationSettings(raw: unknown): LocalizationSettings {
  const src =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}

  const localesEnabled = normalizeLocalesEnabled(src.localesEnabled)
  let defaultLocale = isAppLocale(src.defaultLocale)
    ? src.defaultLocale
    : DEFAULT_LOCALE
  if (!localesEnabled.includes(defaultLocale)) {
    defaultLocale = isAppLocale(localesEnabled[0])
      ? localesEnabled[0]
      : DEFAULT_LOCALE
  }

  return {
    localesEnabled,
    defaultLocale,
    localeFallback: asBool(src.localeFallback, DEFAULT_LOCALIZATION.localeFallback),
  }
}
