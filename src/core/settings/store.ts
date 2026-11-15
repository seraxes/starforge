import { eq } from 'drizzle-orm'

import { db, SITE_SETTINGS_ID, sfSiteSettings } from '@/core/db'

export type SiteSettingsRow = typeof sfSiteSettings.$inferSelect

export type SiteSettingsWrite = {
  siteName: string
  primaryNavMenuId: string
  adminAutosaveDebounceMs: number
  formRateLimitMax: number
  formRateLimitWindowSec: number
  publishedCacheEnabled: boolean
  publishedCacheTtlSec: number
  nullMissTtlSec: number
  dashboardRefreshIntervalSec: number
  dashboardOnlineWindowMin: number
  realtimeEnabled: boolean
  featureRegistration: boolean
  featureRichEditor: boolean
  featurePosts: boolean
  featureModules: boolean
  featureDraftPreview: boolean
  moduleToggles: Array<{ moduleId: string; enabled: boolean }>
}

function errorChain(error: unknown): unknown[] {
  const chain: unknown[] = []
  let current: unknown = error
  for (let i = 0; i < 5 && current != null; i += 1) {
    chain.push(current)
    if (typeof current !== 'object' || !('cause' in current)) break
    current = (current as { cause?: unknown }).cause
  }
  return chain
}

export function isMissingSiteSettingsTable(error: unknown): boolean {
  for (const item of errorChain(error)) {
    if (typeof item === 'object' && item && 'code' in item && (item as { code?: string }).code === '42P01') {
      return true
    }
    const message = item instanceof Error ? item.message : typeof item === 'string' ? item : ''
    if (message.includes('sf_site_settings') && /does not exist|undefined_table/i.test(message)) {
      return true
    }
  }
  return false
}

/** Singleton row, or null when the table or row is missing. */
export async function readSiteSettingsRow(): Promise<SiteSettingsRow | null> {
  try {
    const [row] = await db
      .select()
      .from(sfSiteSettings)
      .where(eq(sfSiteSettings.id, SITE_SETTINGS_ID))
      .limit(1)
    return row ?? null
  } catch (error) {
    if (isMissingSiteSettingsTable(error)) return null
    throw error
  }
}

/**
 * Upsert the singleton. Leaves `legacy_primary_nav` and `payload_copied_at` unchanged.
 */
export async function writeSiteSettingsRow(input: SiteSettingsWrite): Promise<SiteSettingsRow> {
  const now = new Date()
  try {
    const [existing] = await db
      .select({ id: sfSiteSettings.id })
      .from(sfSiteSettings)
      .where(eq(sfSiteSettings.id, SITE_SETTINGS_ID))
      .limit(1)

    if (existing) {
      const [row] = await db
        .update(sfSiteSettings)
        .set({ ...input, updatedAt: now })
        .where(eq(sfSiteSettings.id, SITE_SETTINGS_ID))
        .returning()
      if (!row) throw new Error('sf_site_settings update returned no row')
      return row
    }

    const [row] = await db
      .insert(sfSiteSettings)
      .values({
        id: SITE_SETTINGS_ID,
        ...input,
        legacyPrimaryNav: [],
        createdAt: now,
        updatedAt: now,
      })
      .returning()
    if (!row) throw new Error('sf_site_settings insert returned no row')
    return row
  } catch (error) {
    if (isMissingSiteSettingsTable(error)) {
      throw new Error('sf_site_settings missing — run npm run db:migrate.')
    }
    throw error
  }
}
