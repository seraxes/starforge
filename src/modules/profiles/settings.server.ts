import 'server-only'

import {
  loadModuleSettingsDocument,
  saveModuleSettingsDocument,
} from '@/core/modules/module-settings-store'
import { MODULE_IDS } from '@/core/settings'

import { applyProfileFormConfigToSettings, type ProfileFormConfig } from './profile-form-config'
import { loadProfileFormConfig } from './profile-form'
import { normalizeProfilesModuleSettings } from './settings'
import {
  DEFAULT_PROFILES_MODULE_SETTINGS,
  type ProfilesModuleSettings,
} from './types'

/** Raw module settings document (visibility defaults etc.) — no Forms overlay. */
export async function loadProfilesModuleSettingsRaw(): Promise<{
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

/**
 * Runtime settings: Forms definition drives enabled/required; site settings keep
 * default visibility and account options.
 */
export async function loadProfilesModuleSettings(): Promise<{
  settings: ProfilesModuleSettings
  formConfig: ProfileFormConfig
  source: 'database' | 'default'
  isFallback: boolean
}> {
  const loaded = await loadProfilesModuleSettingsRaw()
  const formConfig = await loadProfileFormConfig()
  return {
    settings: applyProfileFormConfigToSettings(loaded.settings, formConfig),
    formConfig,
    source: loaded.source,
    isFallback: loaded.isFallback,
  }
}

export async function saveProfilesModuleSettings(
  input: Partial<ProfilesModuleSettings>,
): Promise<ProfilesModuleSettings> {
  const current = await loadProfilesModuleSettingsRaw()
  const next = normalizeProfilesModuleSettings({ ...current.settings, ...input })
  await saveModuleSettingsDocument(MODULE_IDS.profiles, { ...next })
  return next
}
