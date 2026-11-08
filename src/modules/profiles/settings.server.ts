import 'server-only'

import {
  loadModuleSettingsDocument,
  saveModuleSettingsDocument,
} from '@/core/modules/module-settings-store'
import { MODULE_IDS } from '@/core/settings'

import { normalizeProfilesModuleSettings } from './settings'
import {
  DEFAULT_PROFILES_MODULE_SETTINGS,
  type ProfilesModuleSettings,
} from './types'

export async function loadProfilesModuleSettings(): Promise<{
  settings: ProfilesModuleSettings
  source: 'database' | 'default'
  isFallback: boolean
}> {
  const loaded = await loadModuleSettingsDocument(MODULE_IDS.profiles, () => ({
    ...DEFAULT_PROFILES_MODULE_SETTINGS,
  }))
  return {
    settings: normalizeProfilesModuleSettings(loaded.document),
    source: loaded.source,
    isFallback: loaded.isFallback,
  }
}

export async function saveProfilesModuleSettings(
  input: Partial<ProfilesModuleSettings>,
): Promise<ProfilesModuleSettings> {
  const current = await loadProfilesModuleSettings()
  const next = normalizeProfilesModuleSettings({ ...current.settings, ...input })
  await saveModuleSettingsDocument(MODULE_IDS.profiles, { ...next })
  return next
}
