/**
 * product:social module settings — one document in `sf_module_settings`
 * (id = product:social).
 */

import 'server-only'

import {
  loadModuleSettingsDocument,
  saveModuleSettingsDocument,
} from '@/core/modules/module-settings-store'
import { MODULE_IDS } from '@/core/settings'

import {
  decideSocialPackSettings,
  DEFAULT_SOCIAL_MODULE_SETTINGS,
  normalizeSocialModuleSettings,
  socialPackSettingsError,
  type SocialModuleSettings,
} from './pack-settings'

export async function loadSocialModuleSettings(): Promise<{
  settings: SocialModuleSettings
  source: 'database' | 'default'
  isFallback: boolean
}> {
  const loaded = await loadModuleSettingsDocument(MODULE_IDS.social, () => ({
    ...DEFAULT_SOCIAL_MODULE_SETTINGS,
  }))
  return {
    settings: normalizeSocialModuleSettings(loaded.document),
    source: loaded.source,
    isFallback: loaded.isFallback,
  }
}

export async function saveSocialModuleSettings(input: unknown): Promise<SocialModuleSettings> {
  const decision = decideSocialPackSettings(input)
  if (!decision.ok) {
    throw new Error(socialPackSettingsError(decision.reason))
  }
  await saveModuleSettingsDocument(MODULE_IDS.social, { ...decision.settings })
  return decision.settings
}
