import 'server-only'

import { eq } from 'drizzle-orm'
import { cache } from 'react'

import { db, MEDIA_PIPELINE_SETTINGS_ID, sfMediaSettings } from '@/core/db'

import {
  DEFAULT_MEDIA_PIPELINE_RULES,
  normalizeMediaPipelineRules,
  type MediaPipelineRules,
} from './pipeline'

export type MediaSettingsLoadResult = {
  rules: MediaPipelineRules
  source: 'database' | 'default'
  isFallback: boolean
}

async function loadMediaPipelineRulesUncached(): Promise<MediaSettingsLoadResult> {
  try {
    const rows = await db
      .select({ document: sfMediaSettings.document })
      .from(sfMediaSettings)
      .where(eq(sfMediaSettings.id, MEDIA_PIPELINE_SETTINGS_ID))
      .limit(1)
    const raw = rows[0]?.document
    if (typeof raw === 'string' && raw.trim()) {
      try {
        return {
          rules: normalizeMediaPipelineRules(JSON.parse(raw) as unknown),
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
    rules: {
      ...DEFAULT_MEDIA_PIPELINE_RULES,
      decodeByGroup: {},
      resizeByGroup: {},
      sizes: { ...DEFAULT_MEDIA_PIPELINE_RULES.sizes },
    },
    source: 'default',
    isFallback: true,
  }
}

export const getMediaPipelineRules = cache(async (): Promise<MediaPipelineRules> => {
  const loaded = await loadMediaPipelineRulesUncached()
  return loaded.rules
})

export async function loadMediaPipelineRules(): Promise<MediaSettingsLoadResult> {
  return loadMediaPipelineRulesUncached()
}

export async function saveMediaPipelineRules(
  next: MediaPipelineRules | unknown,
): Promise<MediaPipelineRules> {
  const normalized = normalizeMediaPipelineRules(next)
  const document = JSON.stringify(normalized)
  try {
    const existing = await db
      .select({ id: sfMediaSettings.id })
      .from(sfMediaSettings)
      .where(eq(sfMediaSettings.id, MEDIA_PIPELINE_SETTINGS_ID))
      .limit(1)
    if (existing[0]) {
      await db
        .update(sfMediaSettings)
        .set({ document, updatedAt: new Date() })
        .where(eq(sfMediaSettings.id, MEDIA_PIPELINE_SETTINGS_ID))
    } else {
      await db.insert(sfMediaSettings).values({
        id: MEDIA_PIPELINE_SETTINGS_ID,
        document,
      })
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('sf_media_settings')) throw error
    throw new Error(
      'sf_media_settings table missing — run npm run db:core:push before saving Media Settings.',
    )
  }
  return normalized
}
