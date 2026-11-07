/**
 * product:pwa module settings — document in `sf_module_settings`.
 */

import 'server-only'

import {
  loadModuleSettingsDocument,
  saveModuleSettingsDocument,
} from '@/core/modules/module-settings-store'
import { MODULE_IDS } from '@/core/settings'

import { normalizePwaModuleSettings } from './normalize'
import { DEFAULT_PWA_MODULE_SETTINGS, type PwaModuleSettings } from './types'

export { normalizePwaModuleSettings } from './normalize'

export async function loadPwaModuleSettings(): Promise<{
  settings: PwaModuleSettings
  source: 'database' | 'default'
  isFallback: boolean
}> {
  const loaded = await loadModuleSettingsDocument(MODULE_IDS.pwa, () => ({
    ...DEFAULT_PWA_MODULE_SETTINGS,
  }))
  return {
    settings: normalizePwaModuleSettings(loaded.document),
    source: loaded.source,
    isFallback: loaded.isFallback,
  }
}

export async function savePwaModuleSettings(
  input: Partial<PwaModuleSettings>,
): Promise<PwaModuleSettings> {
  const current = await loadPwaModuleSettings()
  const next = normalizePwaModuleSettings({
    ...current.settings,
    ...input,
  })
  await saveModuleSettingsDocument(MODULE_IDS.pwa, { ...next })
  return next
}
