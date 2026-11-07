/**
 * product:events module settings — document in `sf_module_settings`.
 */

import 'server-only'

import {
  loadModuleSettingsDocument,
  saveModuleSettingsDocument,
} from '@/core/modules/module-settings-store'
import { MODULE_IDS } from '@/core/settings'

import {
  DEFAULT_EVENTS_MODULE_SETTINGS,
  type EventsModuleSettings,
} from './types'

function parsePreventDuplicate(raw: unknown): boolean {
  if (raw === false || raw === 0 || raw === '0' || raw === 'false') return false
  if (raw === true || raw === 1 || raw === '1' || raw === 'true') return true
  return DEFAULT_EVENTS_MODULE_SETTINGS.preventDuplicate
}

export function normalizeEventsModuleSettings(
  raw: unknown,
): EventsModuleSettings {
  const obj =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}
  const tz = String(obj.defaultTimezone ?? '').trim().slice(0, 80)
  return {
    defaultTimezone: tz || DEFAULT_EVENTS_MODULE_SETTINGS.defaultTimezone,
    preventDuplicate: parsePreventDuplicate(obj.preventDuplicate),
  }
}

export async function loadEventsModuleSettings(): Promise<{
  settings: EventsModuleSettings
  source: 'database' | 'default'
  isFallback: boolean
}> {
  const loaded = await loadModuleSettingsDocument(
    MODULE_IDS.events,
    () => ({ ...DEFAULT_EVENTS_MODULE_SETTINGS }),
  )
  return {
    settings: normalizeEventsModuleSettings(loaded.document),
    source: loaded.source,
    isFallback: loaded.isFallback,
  }
}

export async function saveEventsModuleSettings(
  input: Partial<EventsModuleSettings>,
): Promise<EventsModuleSettings> {
  const current = await loadEventsModuleSettings()
  const next = normalizeEventsModuleSettings({
    ...current.settings,
    ...input,
  })
  await saveModuleSettingsDocument(MODULE_IDS.events, { ...next })
  return next
}
