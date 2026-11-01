import { eq } from 'drizzle-orm'
import { cache } from 'react'

import { contentCacheTags, getPublishedContentCache } from '@/core/content/cache'
import { db, SITE_CHROME_ID, sfSiteChrome } from '@/core/db'
import { DEFAULT_SITE_NAME } from '@/core/settings/defaults'

import { applySiteChromeCookieAttributes } from './cookie-attrs'
import { DEFAULT_SITE_CHROME } from './defaults'
import { normalizeSiteChrome, parseSiteChromeJson, serializeSiteChrome } from './normalize'
import type { SiteChromeDocument, SiteChromeLoadResult } from './types'

function withCookieAttrs(chrome: SiteChromeDocument): SiteChromeDocument {
  applySiteChromeCookieAttributes(chrome)
  return chrome
}

async function loadSiteChromeUncached(): Promise<SiteChromeLoadResult> {
  try {
    const [row] = await db
      .select({ document: sfSiteChrome.document })
      .from(sfSiteChrome)
      .where(eq(sfSiteChrome.id, SITE_CHROME_ID))
      .limit(1)

    if (row?.document?.trim()) {
      const parsed = parseSiteChromeJson(row.document)
      if (parsed) {
        return {
          chrome: withCookieAttrs(parsed),
          source: 'database',
          isFallback: false,
        }
      }
    }
  } catch {
    // Table may not exist yet — fall through.
  }

  // Prefer Payload site name when chrome row is missing (legacy sync).
  let siteName = DEFAULT_SITE_CHROME.siteName
  try {
    const { getSiteSettings } = await import('@/core/settings')
    const settings = await getSiteSettings()
    if (settings.siteName?.trim()) siteName = settings.siteName.trim()
  } catch {
    siteName = DEFAULT_SITE_NAME
  }

  const chrome = withCookieAttrs({ ...DEFAULT_SITE_CHROME, siteName })
  return { chrome, source: 'default', isFallback: true }
}

/**
 * Load Site Chrome (cached + React request dedupe).
 * Falls back to defaults when `sf_site_chrome` is missing.
 */
export const getSiteChrome = cache(async (): Promise<SiteChromeDocument> => {
  const result = await getPublishedContentCache().getCached(
    {
      key: ['sf', 'site-chrome'],
      tags: [contentCacheTags.siteChrome],
      revalidate: false,
    },
    async () => {
      const loaded = await loadSiteChromeUncached()
      return loaded.chrome
    },
  )
  return withCookieAttrs(result)
})

export async function loadSiteChrome(): Promise<SiteChromeLoadResult> {
  return loadSiteChromeUncached()
}

/** Upsert Site Chrome JSON (singleton). */
export async function saveSiteChrome(input: Partial<SiteChromeDocument>): Promise<SiteChromeDocument> {
  const current = await loadSiteChromeUncached()
  const normalized = normalizeSiteChrome({ ...current.chrome, ...input })
  const json = serializeSiteChrome(normalized)
  const now = new Date()

  const [existing] = await db
    .select({ id: sfSiteChrome.id })
    .from(sfSiteChrome)
    .where(eq(sfSiteChrome.id, SITE_CHROME_ID))
    .limit(1)

  if (existing) {
    await db
      .update(sfSiteChrome)
      .set({ document: json, updatedAt: now })
      .where(eq(sfSiteChrome.id, SITE_CHROME_ID))
  } else {
    await db.insert(sfSiteChrome).values({
      id: SITE_CHROME_ID,
      document: json,
      createdAt: now,
      updatedAt: now,
    })
  }

  withCookieAttrs(normalized)

  // Keep Payload site-settings.siteName in sync for header / legacy consumers.
  try {
    const { getSiteSettings, updateSiteSettings } = await import('@/core/settings')
    const settings = await getSiteSettings()
    if (settings.siteName !== normalized.siteName) {
      await updateSiteSettings({
        siteName: normalized.siteName,
        primaryNavMenuId: settings.primaryNavMenuId,
        keepLegacyPrimaryNav: true,
        features: settings.features,
        moduleToggles: settings.moduleToggles,
      })
    }
  } catch {
    // Payload may be unavailable during early bootstrap.
  }

  return normalized
}

/** Seed helper: write defaults when no row exists (copies site name from settings). */
export async function ensureSiteChromeSeeded(): Promise<{
  created: boolean
  chrome: SiteChromeDocument
}> {
  try {
    const [row] = await db
      .select({ id: sfSiteChrome.id, document: sfSiteChrome.document })
      .from(sfSiteChrome)
      .where(eq(sfSiteChrome.id, SITE_CHROME_ID))
      .limit(1)

    if (row?.document?.trim()) {
      const parsed = parseSiteChromeJson(row.document)
      if (parsed) {
        return { created: false, chrome: withCookieAttrs(parsed) }
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('sf_site_chrome')) throw error
    throw new Error(
      'sf_site_chrome table missing — run npm run db:core:push before seeding Site Chrome.',
    )
  }

  let siteName = DEFAULT_SITE_CHROME.siteName
  try {
    const { getSiteSettings } = await import('@/core/settings')
    const settings = await getSiteSettings()
    if (settings.siteName?.trim()) siteName = settings.siteName.trim()
  } catch {
    // ignore
  }

  const chrome = await saveSiteChrome({ ...DEFAULT_SITE_CHROME, siteName })
  return { created: true, chrome }
}
