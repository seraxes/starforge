import 'server-only'

import { isCatalogModuleEnabled, type SiteSettingsData } from '@/core/settings'
import { MODULE_IDS } from '@/core/settings/module-toggles'

export const RICH_EDITOR_MODULE_ID = MODULE_IDS.richEditor

/** Site Settings → Modules gate for product:rich-editor. */
export function isRichEditorEnabled(settings: SiteSettingsData): boolean {
  return isCatalogModuleEnabled(settings, RICH_EDITOR_MODULE_ID)
}
