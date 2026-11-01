import 'server-only'

import { eq } from 'drizzle-orm'
import { cache } from 'react'

import { db, FORMS_MODULE_SETTINGS_ID, sfFormSettings } from '@/core/db'

import {
  defaultFormsModuleSettings,
  normalizeFormsModuleSettings,
} from './module-settings'
import type { FormsModuleSettings } from './types'

export type FormsSettingsLoadResult = {
  settings: FormsModuleSettings
  source: 'database' | 'default'
  isFallback: boolean
}

async function loadFormsModuleSettingsUncached(): Promise<FormsSettingsLoadResult> {
  try {
    const rows = await db
      .select({ document: sfFormSettings.document })
      .from(sfFormSettings)
      .where(eq(sfFormSettings.id, FORMS_MODULE_SETTINGS_ID))
      .limit(1)
    const raw = rows[0]?.document
    if (typeof raw === 'string' && raw.trim()) {
      try {
        return {
          settings: normalizeFormsModuleSettings(JSON.parse(raw) as unknown),
          source: 'database',
          isFallback: false,
        }
      } catch {
        // fall through
      }
    }
  } catch {
    // table missing until db:core:push
  }
  return {
    settings: defaultFormsModuleSettings(),
    source: 'default',
    isFallback: true,
  }
}

export const getFormsModuleSettings = cache(async (): Promise<FormsModuleSettings> => {
  const loaded = await loadFormsModuleSettingsUncached()
  return loaded.settings
})

export async function loadFormsModuleSettings(): Promise<FormsSettingsLoadResult> {
  return loadFormsModuleSettingsUncached()
}

export async function saveFormsModuleSettings(
  next: FormsModuleSettings,
): Promise<FormsModuleSettings> {
  const normalized = normalizeFormsModuleSettings(next)
  const document = JSON.stringify(normalized)
  try {
    const existing = await db
      .select({ id: sfFormSettings.id })
      .from(sfFormSettings)
      .where(eq(sfFormSettings.id, FORMS_MODULE_SETTINGS_ID))
      .limit(1)
    if (existing[0]) {
      await db
        .update(sfFormSettings)
        .set({ document, updatedAt: new Date() })
        .where(eq(sfFormSettings.id, FORMS_MODULE_SETTINGS_ID))
    } else {
      await db.insert(sfFormSettings).values({
        id: FORMS_MODULE_SETTINGS_ID,
        document,
      })
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('sf_form_settings')) throw error
    throw new Error(
      'sf_form_settings table missing — run npm run db:core:push before saving Forms Settings.',
    )
  }
  return normalized
}
