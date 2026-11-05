import {
  DEFAULT_LOCALE,
  DEFAULT_LOCALE_CATALOG,
  isValidLocaleCode,
  normalizeLocaleCode,
  type LocaleCatalogEntry,
} from '@/core/i18n/locales'

import { DEFAULT_LOCALIZATION } from './defaults'
import type { LocalizationSettings } from './types'

function normalizeCatalogEntry(raw: unknown): LocaleCatalogEntry | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const row = raw as Record<string, unknown>
  const code = normalizeLocaleCode(typeof row.code === 'string' ? row.code : '')
  if (!isValidLocaleCode(code)) return null
  const label =
    typeof row.label === 'string' && row.label.trim()
      ? row.label.trim().slice(0, 64)
      : code
  return { code, label }
}

/** Normalize catalog; always keep at least the bootstrap defaults. */
export function normalizeLocaleCatalog(value: unknown): LocaleCatalogEntry[] {
  const seen = new Set<string>()
  const out: LocaleCatalogEntry[] = []

  const push = (entry: LocaleCatalogEntry) => {
    if (seen.has(entry.code)) return
    seen.add(entry.code)
    out.push(entry)
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const normalized = normalizeCatalogEntry(entry)
      if (normalized) push(normalized)
    }
  }

  // Ensure bootstrap codes exist (labels from input win when already present).
  for (const boot of DEFAULT_LOCALE_CATALOG) {
    if (!seen.has(boot.code)) push({ ...boot })
  }

  return out.length > 0 ? out : DEFAULT_LOCALE_CATALOG.map((e) => ({ ...e }))
}

function normalizeLocalesEnabled(
  value: unknown,
  catalogCodes: ReadonlySet<string>,
): string[] {
  if (!Array.isArray(value)) {
    return DEFAULT_LOCALIZATION.localesEnabled.filter((c) => catalogCodes.has(c))
  }
  const seen = new Set<string>()
  const out: string[] = []
  for (const entry of value) {
    const code = normalizeLocaleCode(typeof entry === 'string' ? entry : '')
    if (!catalogCodes.has(code) || seen.has(code)) continue
    seen.add(code)
    out.push(code)
  }
  if (out.length > 0) return out
  // Fallback: first catalog code (bootstrap en).
  const first = [...catalogCodes][0] || DEFAULT_LOCALE
  return [first]
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

  const localeCatalog = normalizeLocaleCatalog(src.localeCatalog)
  const catalogCodes = new Set(localeCatalog.map((e) => e.code))
  const localesEnabled = normalizeLocalesEnabled(src.localesEnabled, catalogCodes)

  let defaultLocale = normalizeLocaleCode(
    typeof src.defaultLocale === 'string' ? src.defaultLocale : DEFAULT_LOCALE,
  )
  if (!localesEnabled.includes(defaultLocale)) {
    defaultLocale = localesEnabled[0] || DEFAULT_LOCALE
  }

  return {
    localeCatalog,
    localesEnabled,
    defaultLocale,
    localeFallback: asBool(src.localeFallback, DEFAULT_LOCALIZATION.localeFallback),
  }
}
