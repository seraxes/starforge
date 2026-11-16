/**
 * Host loader for the product:pages public door.
 *
 * Core must not import `@/modules/pages` (that is a forbidden layer).
 * The generated registry loads `@/modules/pages/api.server` when the pack
 * is allowlisted and the site toggle is on. Returns null when Pages is off.
 * Callers then serve empty page reads. There is no Payload fallback.
 */

import 'server-only'

import type { PageReadsPort } from '@/core/content/page-reads/types'
import type { NavPageOption } from '@/core/nav/types'

export const PAGES_MODULE_ID = 'product:pages'
export const PAGES_DOOR_ID = 'pages-api'

export type PagesPackDoor = {
  createPagesPageReads: () => PageReadsPort
  listNavPageOptions: () => Promise<NavPageOption[]>
  findNavPageBySlug: (
    slug: string,
  ) => Promise<{ id: string; title: string; slug: string } | null>
  findNavPageByLegacyId: (
    legacyId: number,
  ) => Promise<{ id: string; title: string; slug: string } | null>
}

/**
 * Toggle read that does not call `getSiteSettings`.
 * That loader resolves nav, and nav calls this door. Going back through
 * `getSiteSettings` deadlocks the in-flight React cache.
 */
async function pagesPackEnabled(): Promise<boolean> {
  const { isModuleAllowlisted } = await import('@/generated/module-registry')
  if (!isModuleAllowlisted(PAGES_MODULE_ID)) return false
  const { DEFAULT_SITE_SETTINGS } = await import('@/core/settings/defaults')
  const { normalizeModuleToggles } = await import('@/core/settings/module-toggles')
  const { isCatalogModuleEnabled } = await import('@/core/settings/module-catalog')
  const { readSiteSettingsRow } = await import('@/core/settings/store')
  const row = await readSiteSettingsRow()
  const moduleToggles = normalizeModuleToggles(row?.moduleToggles)
  return isCatalogModuleEnabled(
    { ...DEFAULT_SITE_SETTINGS, moduleToggles },
    PAGES_MODULE_ID,
  )
}

export async function loadPagesPackDoor(): Promise<PagesPackDoor | null> {
  try {
    if (!(await pagesPackEnabled())) return null
    const { loadModuleDoor } = await import('@/generated/module-registry.server')
    const door = await loadModuleDoor(PAGES_DOOR_ID)
    if (!door) return null
    if (
      typeof door.createPagesPageReads !== 'function' ||
      typeof door.listNavPageOptions !== 'function' ||
      typeof door.findNavPageBySlug !== 'function'
    ) {
      return null
    }
    return {
      createPagesPageReads: door.createPagesPageReads as PagesPackDoor['createPagesPageReads'],
      listNavPageOptions: door.listNavPageOptions as PagesPackDoor['listNavPageOptions'],
      findNavPageBySlug: door.findNavPageBySlug as PagesPackDoor['findNavPageBySlug'],
      findNavPageByLegacyId:
        typeof door.findNavPageByLegacyId === 'function'
          ? (door.findNavPageByLegacyId as PagesPackDoor['findNavPageByLegacyId'])
          : async () => null,
    }
  } catch {
    return null
  }
}
