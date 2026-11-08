/**
 * Skin → layout outlines (Gantry-like theme YAML packs, stored as LayoutDocument JSON).
 * Seeds install into `sf_layouts` idempotently — never delete user outlines.
 */
import 'server-only'

import { GLOBAL_PAGE_CHROME_ID } from '@/core/db'
import {
  getLayoutOutline,
  saveLayoutDocument,
} from '@/core/modules/layout-store'
import { normalizeLayoutDocument } from '@/core/modules/document'
import type { LayoutDocument } from '@/core/modules/types'
import {
  loadGlobalPageChrome,
  savePageChrome,
} from '@/core/page-settings/store'

import { listSkinOutlineSeeds } from './outline-meta'
import { getSkin } from './registry'
import type { SkinId } from './types'

export type SkinOutlineSeedResult = {
  skinId: SkinId
  created: string[]
  skipped: string[]
  preferredOutlineId: string | null
  globalLayoutIdUpdated: boolean
}

function asLayoutDocument(raw: LayoutDocument | Record<string, unknown>): LayoutDocument | null {
  return normalizeLayoutDocument(raw as LayoutDocument)
}

export { isOutlineOwnedBySkin, listSkinOutlineSeeds } from './outline-meta'

/**
 * Ensure each seed outline exists in `sf_layouts`.
 * Existing rows are left alone unless `forceUpdate` is set on the seed.
 * When `applyPreferredOutline` is true, sets global Page Settings `layoutId`
 * to the skin’s preferred outline (site default assignment — not per-page overrides).
 */
export async function ensureSkinOutlineSeeds(
  skinId: SkinId,
  options?: { applyPreferredOutline?: boolean },
): Promise<SkinOutlineSeedResult> {
  const skin = getSkin(skinId)
  const empty: SkinOutlineSeedResult = {
    skinId,
    created: [],
    skipped: [],
    preferredOutlineId: null,
    globalLayoutIdUpdated: false,
  }
  if (!skin) return empty

  const seeds = listSkinOutlineSeeds(skin)
  const created: string[] = []
  const skipped: string[] = []

  for (const seed of seeds) {
    const id = seed.id.trim()
    if (!id) continue
    const existing = await getLayoutOutline(id)
    if (existing && !seed.forceUpdate) {
      skipped.push(id)
      continue
    }
    const doc = asLayoutDocument(seed.document)
    if (!doc) {
      skipped.push(id)
      continue
    }
    await saveLayoutDocument(doc, id, { label: seed.label })
    created.push(id)
  }

  const preferred =
    (typeof skin.preferredDefaultOutlineId === 'string' &&
      skin.preferredDefaultOutlineId.trim()) ||
    seeds.find((s) => s.defaultForSite)?.id ||
    seeds[0]?.id ||
    null

  let globalLayoutIdUpdated = false
  if (options?.applyPreferredOutline && preferred) {
    try {
      const { chrome } = await loadGlobalPageChrome()
      if (chrome.layoutId !== preferred) {
        await savePageChrome(GLOBAL_PAGE_CHROME_ID, {
          ...chrome,
          layoutId: preferred,
        })
        globalLayoutIdUpdated = true
      }
    } catch {
      // page chrome table may be missing until migrate
    }
  }

  return {
    skinId,
    created,
    skipped,
    preferredOutlineId: preferred,
    globalLayoutIdUpdated,
  }
}
