/**
 * Editor-typed text that varies by public locale.
 * `fallback` is the legacy single string (usually the default locale).
 */

export type LocaleTextMap = Record<string, string>

export type ContentLocaleOption = {
  code: string
  label: string
  isDefault: boolean
}

export function normalizeLocaleTextMap(raw: unknown): LocaleTextMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: LocaleTextMap = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const code = key.trim()
    if (!code || typeof value !== 'string') continue
    const text = value.trim()
    if (text) out[code] = text
  }
  return out
}

export function contentLocaleOptions(input: {
  catalog: { code: string; label: string }[]
  enabled: string[]
  defaultLocale: string
}): ContentLocaleOption[] {
  const enabled = input.enabled.map((code) => code.trim()).filter(Boolean)
  const codes = enabled.length > 0 ? [...enabled] : []
  const fallback = input.defaultLocale.trim()
  if (fallback && !codes.includes(fallback)) codes.unshift(fallback)
  if (codes.length === 0 && fallback) codes.push(fallback)
  const labels = new Map(input.catalog.map((entry) => [entry.code, entry.label]))
  return codes.map((code) => ({
    code,
    label: labels.get(code) || code,
    isDefault: code === fallback,
  }))
}

/**
 * Current locale, then the default locale when fallback is on, then the legacy string.
 */
export function pickLocaleText(
  map: LocaleTextMap | undefined,
  fallback: string,
  locale: string,
  defaultLocale: string,
  fallbackEnabled: boolean,
): string {
  const current = map?.[locale]?.trim()
  if (current) return current
  if (fallbackEnabled && locale !== defaultLocale) {
    const fromDefault = map?.[defaultLocale]?.trim()
    if (fromDefault) return fromDefault
  }
  const plain = fallback.trim()
  if (plain) return plain
  if (fallbackEnabled) {
    const fromDefault = map?.[defaultLocale]?.trim()
    if (fromDefault) return fromDefault
  }
  return ''
}
