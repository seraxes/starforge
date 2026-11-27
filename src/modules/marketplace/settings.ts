/**
 * product:marketplace module settings — document in `sf_module_settings`.
 */

import 'server-only'

import {
  loadModuleSettingsDocument,
  saveModuleSettingsDocument,
} from '@/core/modules/module-settings-store'
import { MODULE_IDS } from '@/core/settings'

import {
  DEFAULT_MARKETPLACE_MODULE_SETTINGS,
  type MarketplaceModuleSettings,
} from './types'

function parsePositiveInt(raw: unknown, fallback: number, max: number): number {
  if (raw == null || raw === '') return fallback
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim())
  if (!Number.isFinite(n) || n < 1) return fallback
  return Math.min(max, Math.trunc(n))
}

function parseNonNegInt(raw: unknown, fallback: number, max: number): number {
  if (raw == null || raw === '') return fallback
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim())
  if (!Number.isFinite(n) || n < 0) return fallback
  return Math.min(max, Math.trunc(n))
}

function parseBool(raw: unknown, fallback: boolean): boolean {
  if (raw === false || raw === 0 || raw === '0' || raw === 'false') return false
  if (raw === true || raw === 1 || raw === '1' || raw === 'true') return true
  return fallback
}

export function normalizeMarketplaceModuleSettings(
  raw: unknown,
): MarketplaceModuleSettings {
  const obj =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}
  return {
    expiryDays: parsePositiveInt(
      obj.expiryDays,
      DEFAULT_MARKETPLACE_MODULE_SETTINGS.expiryDays,
      365,
    ),
    photoCap: parsePositiveInt(
      obj.photoCap,
      DEFAULT_MARKETPLACE_MODULE_SETTINGS.photoCap,
      50,
    ),
    offersEnabled: parseBool(
      obj.offersEnabled,
      DEFAULT_MARKETPLACE_MODULE_SETTINGS.offersEnabled,
    ),
    listingFeeEnabled: parseBool(
      obj.listingFeeEnabled,
      DEFAULT_MARKETPLACE_MODULE_SETTINGS.listingFeeEnabled,
    ),
    listingFeeMinor: parseNonNegInt(
      obj.listingFeeMinor,
      DEFAULT_MARKETPLACE_MODULE_SETTINGS.listingFeeMinor,
      100_000_000,
    ),
  }
}

export async function loadMarketplaceModuleSettings(): Promise<{
  settings: MarketplaceModuleSettings
  source: 'database' | 'default'
  isFallback: boolean
}> {
  const loaded = await loadModuleSettingsDocument(
    MODULE_IDS.marketplace,
    () => ({ ...DEFAULT_MARKETPLACE_MODULE_SETTINGS }),
  )
  return {
    settings: normalizeMarketplaceModuleSettings(loaded.document),
    source: loaded.source,
    isFallback: loaded.isFallback,
  }
}

export async function saveMarketplaceModuleSettings(
  input: Partial<MarketplaceModuleSettings>,
): Promise<MarketplaceModuleSettings> {
  const current = await loadMarketplaceModuleSettings()
  const next = normalizeMarketplaceModuleSettings({
    ...current.settings,
    ...input,
  })
  await saveModuleSettingsDocument(MODULE_IDS.marketplace, { ...next })
  return next
}
