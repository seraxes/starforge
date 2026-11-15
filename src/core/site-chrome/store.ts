import { eq } from 'drizzle-orm'
import { cache } from 'react'

import { db, SITE_CHROME_ID, sfSiteChrome } from '@/core/db'
import { DEFAULT_SITE_NAME } from '@/core/settings/defaults'

import { applyAuthEmailVerificationPolicy } from '@/core/auth/email-verification-policy'

import { applySiteChromeCookieAttributes } from './cookie-attrs'
import { DEFAULT_SITE_CHROME } from './defaults'
import {
  normalizeSiteChrome,
  parseSiteChromeJson,
  serializeSiteChrome,
  siteChromeDocumentNeedsLocaleHeal,
} from './normalize'
import type { SiteChromeDocument, SiteChromeLoadResult } from './types'

/**
 * Process-local Chrome snapshot for the Node proxy offline gate.
 * Saves publish here immediately. Reads must not copy a published-content
 * cache hit back over this snapshot — that stale document re-checked
 * "Take site offline" on reload and put the public site offline again.
 */
let liveSiteChrome: SiteChromeDocument | null = null
let liveRevision = 0

/**
 * True when a read that started at `observedRevision` must keep the snapshot
 * already published by a save that finished while the read was in flight.
 */
export function liveSnapshotWasReplaced(
  observedRevision: number,
  currentRevision: number,
): boolean {
  return observedRevision !== currentRevision
}

function publishLiveSiteChrome(
  chrome: SiteChromeDocument,
  observedRevision?: number,
): { chrome: SiteChromeDocument; applied: boolean } {
  if (
    observedRevision !== undefined &&
    liveSnapshotWasReplaced(observedRevision, liveRevision) &&
    liveSiteChrome
  ) {
    return { chrome: liveSiteChrome, applied: false }
  }
  applySiteChromeCookieAttributes(chrome)
  const normalized = normalizeSiteChrome(chrome)
  applyAuthEmailVerificationPolicy(normalized.authRequireEmailVerification)
  liveSiteChrome = normalized
  liveRevision += 1
  return { chrome: normalized, applied: true }
}

/**
 * Chrome for hot paths that can tolerate a process snapshot — live snapshot,
 * else one uncached DB read. `getSiteChrome()` is the same data with per-request
 * dedupe.
 *
 * Do **not** use this for the offline gate. Turbopack can give the Node proxy
 * and server actions separate copies of this module, so a save that published
 * `offlineEnabled` in one bundle never updates the other — the public site
 * stays on a prerendered Base outline while `/site-offline` looks correct.
 */
export async function getSiteChromeForProxy(): Promise<SiteChromeDocument> {
  if (liveSiteChrome) return liveSiteChrome
  const loaded = await loadSiteChromeUncached()
  return liveSiteChrome ?? loaded.chrome
}

/**
 * Chrome for Take-site-offline: always one uncached DB read (then publish into
 * this bundle’s snapshot). Proxy rewrite + locale soft-lock must share this
 * path so a Chrome toggle cannot leave public URLs on a stale online document.
 */
export async function getSiteChromeForOfflineGate(): Promise<SiteChromeDocument> {
  const loaded = await loadSiteChromeUncached()
  return loaded.chrome
}

/**
 * Persist localization defaults when the stored document omitted those keys
 * (pre-i18n P0 rows, or pre-Localization-page rows lacking `localeFallback`).
 * UI editing lives under `/admin/localization`; storage stays on Chrome JSON.
 */
async function softHealLocaleFields(
  documentJson: string,
  chrome: SiteChromeDocument,
): Promise<void> {
  if (!siteChromeDocumentNeedsLocaleHeal(documentJson)) return
  try {
    const now = new Date()
    await db
      .update(sfSiteChrome)
      .set({ document: serializeSiteChrome(chrome), updatedAt: now })
      .where(eq(sfSiteChrome.id, SITE_CHROME_ID))
  } catch {
    // Soft heal must not block reads (table missing / race).
  }
}

async function loadSiteChromeUncached(): Promise<SiteChromeLoadResult> {
  const observedRevision = liveRevision
  try {
    const [row] = await db
      .select({ document: sfSiteChrome.document })
      .from(sfSiteChrome)
      .where(eq(sfSiteChrome.id, SITE_CHROME_ID))
      .limit(1)

    if (row?.document?.trim()) {
      const parsed = parseSiteChromeJson(row.document)
      if (parsed) {
        const published = publishLiveSiteChrome(parsed, observedRevision)
        // Only heal the row this read actually published. A save that landed
        // while the read was in flight already wrote a complete document.
        if (published.applied) void softHealLocaleFields(row.document, published.chrome)
        return {
          chrome: published.chrome,
          source: 'database',
          isFallback: false,
        }
      }
    }
  } catch {
    // Table may not exist yet — fall through.
  }

  // Prefer Core site settings name when the chrome row is missing.
  let siteName = DEFAULT_SITE_CHROME.siteName
  try {
    const { getSiteSettings } = await import('@/core/settings')
    const settings = await getSiteSettings()
    if (settings.siteName?.trim()) siteName = settings.siteName.trim()
  } catch {
    siteName = DEFAULT_SITE_NAME
  }

  const published = publishLiveSiteChrome(
    { ...DEFAULT_SITE_CHROME, siteName },
    observedRevision,
  )
  return { chrome: published.chrome, source: 'default', isFallback: true }
}

/**
 * Load Site Chrome (React request dedupe + the process snapshot).
 * Falls back to defaults when `sf_site_chrome` is missing.
 * Does not read the published-content cache: a stale hit was copied onto the
 * live snapshot and turned the site offline again on the next reload.
 */
export const getSiteChrome = cache(async (): Promise<SiteChromeDocument> => {
  return getSiteChromeForProxy()
})

export async function loadSiteChrome(): Promise<SiteChromeLoadResult> {
  return loadSiteChromeUncached()
}

/** One writer at a time so a field autosave cannot put an older offline flag back. */
let saveQueue: Promise<void> = Promise.resolve()

/** Upsert Site Chrome JSON (singleton). */
export function saveSiteChrome(input: Partial<SiteChromeDocument>): Promise<SiteChromeDocument> {
  const job = saveQueue.then(() => persistSiteChrome(input))
  saveQueue = job.then(
    () => undefined,
    () => undefined,
  )
  return job
}

async function persistSiteChrome(input: Partial<SiteChromeDocument>): Promise<SiteChromeDocument> {
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

  publishLiveSiteChrome(normalized)

  // Keep sf_site_settings.siteName in sync only when the name actually changed.
  // Offline toggles stay on this Chrome write and do not touch Payload.
  if (normalized.siteName !== current.chrome.siteName) {
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
        const published = publishLiveSiteChrome(parsed)
        if (published.applied) void softHealLocaleFields(row.document, published.chrome)
        return { created: false, chrome: published.chrome }
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('sf_site_chrome')) throw error
    throw new Error(
      'sf_site_chrome table missing — run npm run db:core:push before seeding Chrome.',
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
