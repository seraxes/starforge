/**
 * Skin → layout outlines (Gantry-like theme YAML packs, stored as LayoutDocument JSON).
 * Seeds install into `sf_layouts` idempotently — never delete user outlines.
 */
import 'server-only'

import { DEFAULT_LAYOUT_ID, GLOBAL_PAGE_CHROME_ID } from '@/core/db'
import { ensureLayoutSkinIdColumn } from '@/core/db/ensure-layout-skin-id'
import {
  getLayoutOutline,
  loadLayoutDocument,
  patchLayoutOutlineMeta,
  saveLayoutDocument,
} from '@/core/modules/layout-store'
import { normalizeLayoutDocument } from '@/core/modules/document'
import type { LayoutDocument } from '@/core/modules/types'
import {
  loadGlobalPageChrome,
  savePageChrome,
} from '@/core/page-settings/store'

import { findSkinIdForOutline, listSkinOutlineSeeds } from './outline-meta'
import { getSkin, listSkins } from './registry'
import type { SkinId } from './types'

export type SkinOutlineSeedResult = {
  skinId: SkinId
  created: string[]
  skipped: string[]
  healed: string[]
  preferredOutlineId: string | null
  globalLayoutIdUpdated: boolean
}

function asLayoutDocument(raw: LayoutDocument | Record<string, unknown>): LayoutDocument | null {
  return normalizeLayoutDocument(raw as LayoutDocument)
}

export { isOutlineOwnedBySkin, listSkinOutlineSeeds } from './outline-meta'

/**
 * Ensure each seed outline exists in `sf_layouts` with `skin_id` set.
 * Soft-heals Base label, skin ownership, and system-outline inheritFrom.
 * When `applyPreferredOutline` is true, sets global Page Settings `layoutId`
 * to the skin’s preferred Base outline.
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
    healed: [],
    preferredOutlineId: null,
    globalLayoutIdUpdated: false,
  }
  if (!skin) return empty

  // Self-heal schema so Outlines admin doesn’t crash before `db:core:push`.
  await ensureLayoutSkinIdColumn()

  const seeds = listSkinOutlineSeeds(skin)
  const created: string[] = []
  const skipped: string[] = []
  const healed: string[] = []

  for (const seed of seeds) {
    const id = seed.id.trim()
    if (!id) continue
    const existing = await getLayoutOutline(id)
    const doc = asLayoutDocument(seed.document)
    if (!doc) {
      skipped.push(id)
      continue
    }
    if (existing && !seed.forceUpdate) {
      let didHeal = false
      // Soft-heal system children (Offline / 404): older full copies lacked inheritFrom.
      if (doc.inheritFrom) {
        try {
          const loaded = await loadLayoutDocument(id)
          if (!loaded.document.inheritFrom) {
            await saveLayoutDocument(doc, id, { label: seed.label, skinId })
            healed.push(id)
            didHeal = true
          }
        } catch {
          // keep going
        }
      }
      if (!didHeal) {
        const needsLabel = existing.label !== seed.label
        const needsSkin = existing.skinId !== skinId
        if (needsLabel || needsSkin) {
          await patchLayoutOutlineMeta(id, {
            ...(needsLabel ? { label: seed.label } : {}),
            ...(needsSkin ? { skinId } : {}),
          })
          healed.push(id)
        } else {
          skipped.push(id)
        }
      }
      continue
    }
    await saveLayoutDocument(doc, id, { label: seed.label, skinId })
    created.push(id)
  }

  // Backfill skin_id for orphan outlines (prefix match, or inheritFrom skin Base).
  try {
    const { listLayoutOutlines } = await import('@/core/modules/layout-store')
    const all = await listLayoutOutlines()
    const skins = listSkins()
    const baseId =
      (typeof skin.preferredDefaultOutlineId === 'string' &&
        skin.preferredDefaultOutlineId.trim()) ||
      ''
    for (const row of all) {
      if (row.skinId) continue
      if (row.id === DEFAULT_LAYOUT_ID) continue
      const inferred = findSkinIdForOutline(row.id, skins)
      let match = inferred === skinId
      if (!match && baseId) {
        try {
          const loaded = await loadLayoutDocument(row.id)
          const parent =
            typeof loaded.document.inheritFrom === 'string'
              ? loaded.document.inheritFrom.trim()
              : ''
          if (parent === baseId || parent.startsWith(`${skinId}-`)) match = true
        } catch {
          // ignore
        }
      }
      if (match) {
        await patchLayoutOutlineMeta(row.id, { skinId })
        if (!healed.includes(row.id)) healed.push(row.id)
      }
    }
  } catch {
    // list/patch may fail before migrate
  }

  const preferred =
    (typeof skin.preferredDefaultOutlineId === 'string' &&
      skin.preferredDefaultOutlineId.trim()) ||
    seeds.find((s) => s.defaultForSite)?.id ||
    seeds[0]?.id ||
    null

  let globalLayoutIdUpdated = false
  if (preferred) {
    try {
      const { chrome } = await loadGlobalPageChrome()
      const current = (chrome.layoutId ?? '').trim() || DEFAULT_LAYOUT_ID
      // Apply on skin switch, or soft-heal when site still points at Core `default`.
      const shouldApply =
        options?.applyPreferredOutline || current === DEFAULT_LAYOUT_ID
      if (shouldApply && current !== preferred) {
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
    healed,
    preferredOutlineId: preferred,
    globalLayoutIdUpdated,
  }
}
