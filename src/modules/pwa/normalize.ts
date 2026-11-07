/**
 * Pure normalizers for product:pwa settings (client-safe / unit-testable).
 */

import {
  DEFAULT_PWA_MODULE_SETTINGS,
  PWA_DISPLAY_MODES,
  type PwaDisplayMode,
  type PwaModuleSettings,
} from './types'

function parseDisplay(raw: unknown): PwaDisplayMode {
  const value = String(raw ?? '').trim()
  if ((PWA_DISPLAY_MODES as readonly string[]).includes(value)) {
    return value as PwaDisplayMode
  }
  return DEFAULT_PWA_MODULE_SETTINGS.display
}

function parseColor(raw: unknown, fallback: string): string {
  const value = String(raw ?? '').trim()
  if (/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(value)) return value.toLowerCase()
  return fallback
}

function parseStartUrl(raw: unknown): string {
  const value = String(raw ?? '').trim() || DEFAULT_PWA_MODULE_SETTINGS.startUrl
  if (value.startsWith('http://') || value.startsWith('https://')) {
    try {
      const url = new URL(value)
      return `${url.pathname}${url.search}` || '/'
    } catch {
      return DEFAULT_PWA_MODULE_SETTINGS.startUrl
    }
  }
  return value.startsWith('/') ? value.slice(0, 200) : `/${value.slice(0, 199)}`
}

export function normalizePwaModuleSettings(raw: unknown): PwaModuleSettings {
  const obj =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}
  return {
    shortName: String(obj.shortName ?? '')
      .trim()
      .slice(0, 32),
    themeColor: parseColor(obj.themeColor, DEFAULT_PWA_MODULE_SETTINGS.themeColor),
    backgroundColor: parseColor(
      obj.backgroundColor,
      DEFAULT_PWA_MODULE_SETTINGS.backgroundColor,
    ),
    display: parseDisplay(obj.display),
    startUrl: parseStartUrl(obj.startUrl),
    iconMediaId: String(obj.iconMediaId ?? '')
      .trim()
      .slice(0, 120),
    iconUrl: String(obj.iconUrl ?? '')
      .trim()
      .slice(0, 500),
  }
}
