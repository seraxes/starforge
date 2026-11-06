import 'server-only'

import { isCatalogModuleEnabled, type SiteSettingsData } from '@/core/settings'
import { MODULE_IDS } from '@/core/settings/module-toggles'

export const LEXICAL_EDITOR_MODULE_ID = MODULE_IDS.lexicalEditor

/** Site Settings → Modules gate for optional Lexical pack. */
export function isLexicalEditorEnabled(settings: SiteSettingsData): boolean {
  return isCatalogModuleEnabled(settings, LEXICAL_EDITOR_MODULE_ID)
}
