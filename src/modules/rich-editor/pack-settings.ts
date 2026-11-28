/**
 * product:rich-editor pack settings — document in `sf_module_settings`.
 * Site-wide emoji insert switch (Social composers today; TipTap toolbar later).
 */

import 'server-only'

import {
  loadModuleSettingsDocument,
  saveModuleSettingsDocument,
} from '@/core/modules/module-settings-store'
import { MODULE_IDS } from '@/core/settings'

import {
  DEFAULT_RICH_EDITOR_MODULE_SETTINGS,
  normalizeRichEditorModuleSettings,
  type RichEditorModuleSettings,
} from './module-settings'

export {
  DEFAULT_RICH_EDITOR_MODULE_SETTINGS,
  normalizeRichEditorModuleSettings,
  type RichEditorModuleSettings,
} from './module-settings'

export async function loadRichEditorModuleSettings(): Promise<{
  settings: RichEditorModuleSettings
  source: 'database' | 'default'
  isFallback: boolean
}> {
  const loaded = await loadModuleSettingsDocument(MODULE_IDS.richEditor, () => ({
    ...DEFAULT_RICH_EDITOR_MODULE_SETTINGS,
  }))
  return {
    settings: normalizeRichEditorModuleSettings(loaded.document),
    source: loaded.source,
    isFallback: loaded.isFallback,
  }
}

export async function saveRichEditorModuleSettings(
  input: Partial<RichEditorModuleSettings>,
): Promise<RichEditorModuleSettings> {
  const current = await loadRichEditorModuleSettings()
  const next = normalizeRichEditorModuleSettings({
    ...current.settings,
    ...input,
  })
  await saveModuleSettingsDocument(MODULE_IDS.richEditor, { ...next })
  return next
}

/** Fail-open to default (on) when the settings row is missing. */
export async function isEmojiInsertEnabled(): Promise<boolean> {
  const loaded = await loadRichEditorModuleSettings()
  return loaded.settings.emojiInsertEnabled
}
