/**
 * product:email-manager module settings — pace rules for paced broadcasts.
 */

import 'server-only'

import {
  loadModuleSettingsDocument,
  saveModuleSettingsDocument,
} from '@/core/modules/module-settings-store'
import { MODULE_IDS } from '@/core/settings'

import {
  normalizeEmailManagerModuleSettings,
} from './broadcast'
import {
  DEFAULT_EMAIL_MANAGER_MODULE_SETTINGS,
  type EmailManagerModuleSettings,
} from './types'

export {
  clampBroadcastBatchSize,
  clampBroadcastGapMinutes,
  normalizeEmailManagerModuleSettings,
} from './broadcast'

export async function loadEmailManagerModuleSettings(): Promise<{
  settings: EmailManagerModuleSettings
  source: 'database' | 'default'
  isFallback: boolean
}> {
  const loaded = await loadModuleSettingsDocument(MODULE_IDS.emailManager, () => ({
    ...DEFAULT_EMAIL_MANAGER_MODULE_SETTINGS,
  }))
  return {
    settings: normalizeEmailManagerModuleSettings(loaded.document),
    source: loaded.source,
    isFallback: loaded.isFallback,
  }
}

export async function saveEmailManagerModuleSettings(
  input: Partial<EmailManagerModuleSettings>,
): Promise<EmailManagerModuleSettings> {
  const current = await loadEmailManagerModuleSettings()
  const next = normalizeEmailManagerModuleSettings({
    ...current.settings,
    ...input,
  })
  await saveModuleSettingsDocument(MODULE_IDS.emailManager, { ...next })
  return next
}
