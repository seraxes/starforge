/**
 * Persisted Skin site default — reuses `sf_module_settings` with a Core key.
 */
import 'server-only'

import {
  getModuleSettingsDocument,
  saveModuleSettingsDocument,
} from '@/core/modules/module-settings-store'

import { getDefaultSkinId, isRegisteredSkinId } from './registry'
import type { SkinSettingsDocument } from './types'

/** Synthetic settings id (not a product module). */
export const SKIN_SETTINGS_ID = 'core:skin'

function parseDocument(raw: Record<string, unknown>): SkinSettingsDocument {
  const id = typeof raw.defaultSkinId === 'string' ? raw.defaultSkinId.trim() : ''
  return {
    defaultSkinId: id && isRegisteredSkinId(id) ? id : getDefaultSkinId(),
  }
}

export async function getStoredDefaultSkinId(): Promise<string> {
  const doc = await getModuleSettingsDocument(SKIN_SETTINGS_ID)
  return parseDocument(doc).defaultSkinId
}

export async function saveDefaultSkinId(skinId: string): Promise<SkinSettingsDocument> {
  const id = skinId.trim()
  if (!isRegisteredSkinId(id)) {
    throw new Error(`Unknown skin id: ${skinId}`)
  }
  const next: SkinSettingsDocument = { defaultSkinId: id }
  await saveModuleSettingsDocument(SKIN_SETTINGS_ID, { ...next })
  return next
}
