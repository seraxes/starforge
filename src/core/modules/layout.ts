import { DEFAULT_LAYOUT_ID } from '@/core/db'
import { contentCacheTags, getPublishedContentCache } from '@/core/content/cache'

import { resolveLayoutInheritance } from './inherit'
import { loadLayoutDocument } from './layout-store'
import type { LayoutDocument, LayoutSlot, LayoutPositionId } from './types'

export type PublicLayoutBundle = {
  document: LayoutDocument
  /** Actual outline id after alias / DB resolve (may differ from the request). */
  layoutId: string
}

/**
 * Load a layout document by id (DB first, then default-layout.json),
 * with outline inheritance resolved for public paint.
 * Admin mutators use uncached `loadLayoutDocument` (raw / unmerged).
 * Cross-request cache via published-content cache.
 */
export async function getLayoutDocument(
  layoutId?: string,
): Promise<LayoutDocument> {
  const bundle = await getPublicLayoutBundle(layoutId)
  return bundle.document
}

/** Public paint: resolved document + the outline id that actually loaded. */
export async function getPublicLayoutBundle(
  layoutId?: string,
): Promise<PublicLayoutBundle> {
  const id =
    typeof layoutId === 'string' && layoutId.trim() ? layoutId.trim() : DEFAULT_LAYOUT_ID
  return getPublishedContentCache().getCached(
    {
      key: ['sf', 'layout-bundle', id],
      tags: [contentCacheTags.layouts, contentCacheTags.layout(id)],
      revalidate: false,
    },
    async () => {
      const loaded = await loadLayoutDocument(id)
      const document = await resolveLayoutInheritance(loaded.layoutId, loaded.document)
      return { document, layoutId: loaded.layoutId }
    },
  )
}

/**
 * Enabled slots for one section id (Gantry “position”), sorted by row/slot order.
 * @deprecated Prefer iterating the document in `PublicLayoutBody`.
 */
export async function getAssignmentsForPosition(position: LayoutPositionId): Promise<LayoutSlot[]> {
  const doc = await getLayoutDocument()
  const section = doc.sections.find((s) => s.id === position)
  if (!section) return []
  const out: LayoutSlot[] = []
  for (const row of [...section.rows].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id),
  )) {
    for (const slot of [...row.slots].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id),
    )) {
      if (slot.enabled === false) continue
      out.push(slot)
    }
  }
  return out
}
