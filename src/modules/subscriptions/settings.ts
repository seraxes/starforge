/**
 * product:subscriptions module settings — document in `sf_module_settings`.
 */

import 'server-only'

import {
  loadModuleSettingsDocument,
  saveModuleSettingsDocument,
} from '@/core/modules/module-settings-store'
import { MODULE_IDS } from '@/core/settings'

import {
  DEFAULT_SUBSCRIPTIONS_MODULE_SETTINGS,
  type SubscriptionsModuleSettings,
} from './types'

function parseNonNegInt(raw: unknown, fallback: number): number {
  if (raw == null || raw === '') return fallback
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim())
  if (!Number.isFinite(n) || n < 0) return fallback
  return Math.min(365, Math.floor(n))
}

export function normalizeSubscriptionsModuleSettings(
  raw: unknown,
): SubscriptionsModuleSettings {
  const obj =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}
  return {
    reminderDays: parseNonNegInt(
      obj.reminderDays,
      DEFAULT_SUBSCRIPTIONS_MODULE_SETTINGS.reminderDays,
    ),
    trialReminderDays: parseNonNegInt(
      obj.trialReminderDays,
      DEFAULT_SUBSCRIPTIONS_MODULE_SETTINGS.trialReminderDays,
    ),
    defaultGraceHours: parseNonNegInt(
      obj.defaultGraceHours,
      DEFAULT_SUBSCRIPTIONS_MODULE_SETTINGS.defaultGraceHours,
    ),
    defaultFormDefinitionId:
      String(obj.defaultFormDefinitionId ?? '').trim() ||
      DEFAULT_SUBSCRIPTIONS_MODULE_SETTINGS.defaultFormDefinitionId,
  }
}

export async function loadSubscriptionsModuleSettings(): Promise<{
  settings: SubscriptionsModuleSettings
  source: 'database' | 'default'
  isFallback: boolean
}> {
  const loaded = await loadModuleSettingsDocument(MODULE_IDS.subscriptions, () => ({
    ...DEFAULT_SUBSCRIPTIONS_MODULE_SETTINGS,
  }))
  return {
    settings: normalizeSubscriptionsModuleSettings(loaded.document),
    source: loaded.source,
    isFallback: loaded.isFallback,
  }
}

export async function saveSubscriptionsModuleSettings(
  input: Partial<SubscriptionsModuleSettings>,
): Promise<SubscriptionsModuleSettings> {
  const current = await loadSubscriptionsModuleSettings()
  const next = normalizeSubscriptionsModuleSettings({
    ...current.settings,
    ...input,
  })
  await saveModuleSettingsDocument(MODULE_IDS.subscriptions, { ...next })
  return next
}
