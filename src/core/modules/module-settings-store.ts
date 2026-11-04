/**
 * Generic module settings store — `sf_module_settings` (M2).
 * Packs own document shape; Core hosts load/save by module id.
 */
import 'server-only'

import { eq } from 'drizzle-orm'
import { cache } from 'react'

import { db, sfModuleSettings } from '@/core/db'

export type ModuleSettingsLoadResult = {
  document: Record<string, unknown>
  source: 'database' | 'default'
  isFallback: boolean
}

function asObject(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  return raw as Record<string, unknown>
}

async function loadModuleSettingsUncached(
  moduleId: string,
  defaults: () => Record<string, unknown> = () => ({}),
): Promise<ModuleSettingsLoadResult> {
  const id = moduleId.trim()
  if (!id) {
    return { document: defaults(), source: 'default', isFallback: true }
  }
  try {
    const rows = await db
      .select({ document: sfModuleSettings.document })
      .from(sfModuleSettings)
      .where(eq(sfModuleSettings.id, id))
      .limit(1)
    const parsed = asObject(rows[0]?.document)
    if (parsed) {
      return { document: parsed, source: 'database', isFallback: false }
    }
  } catch {
    // table missing until db:core:migrate / push
  }
  return { document: defaults(), source: 'default', isFallback: true }
}

/** Cached read of a module settings document (empty object when missing). */
export const getModuleSettingsDocument = cache(
  async (moduleId: string): Promise<Record<string, unknown>> => {
    const loaded = await loadModuleSettingsUncached(moduleId)
    return loaded.document
  },
)

export async function loadModuleSettingsDocument(
  moduleId: string,
  defaults?: () => Record<string, unknown>,
): Promise<ModuleSettingsLoadResult> {
  return loadModuleSettingsUncached(moduleId, defaults)
}

export async function saveModuleSettingsDocument(
  moduleId: string,
  document: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const id = moduleId.trim()
  if (!id) throw new Error('moduleId required')
  const next = asObject(document) ?? {}
  try {
    const existing = await db
      .select({ id: sfModuleSettings.id })
      .from(sfModuleSettings)
      .where(eq(sfModuleSettings.id, id))
      .limit(1)
    if (existing[0]) {
      await db
        .update(sfModuleSettings)
        .set({ document: next, updatedAt: new Date() })
        .where(eq(sfModuleSettings.id, id))
    } else {
      await db.insert(sfModuleSettings).values({ id, document: next })
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('sf_module_settings')) throw error
    throw new Error(
      'sf_module_settings table missing — run npm run db:core:migrate (or db:core:push) before saving module settings.',
    )
  }
  return next
}
